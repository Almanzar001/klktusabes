import React, { useState, useEffect } from 'react'
import { Users, Copy, Play, Settings, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { roomHelpers, gameHelpers, realtimeHelpers } from '../insforge'
import { Game, Room, Player, generateRoomCode, AVAILABLE_AVATARS } from '../types'
import GameSelector from './GameSelector'
import PlayerAvatar from './PlayerAvatar'

interface CreateRoomProps {
  onBack: () => void
  onJoinRoom: (room: Room, player: Player) => void
}

const CreateRoom: React.FC<CreateRoomProps> = ({ onBack, onJoinRoom }) => {
  const { user, userProfile } = useAuth()
  
  // Estados principales
  const [currentStep, setCurrentStep] = useState<'game-select' | 'setup' | 'waiting'>('game-select')
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  
  // Estados del formulario
  const [roomName, setRoomName] = useState('')
  const [playerName, setPlayerName] = useState(userProfile?.full_name || '')
  const [selectedAvatar, setSelectedAvatar] = useState(AVAILABLE_AVATARS[0])
  const [maxPlayers, setMaxPlayers] = useState(10)
  
  // Estados de la UI
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  // Cargar juegos disponibles
  useEffect(() => {
    loadGames()
  }, [])

  // Suscribirse a cambios en jugadores cuando hay una sala
  useEffect(() => {
    if (!room) return

    const subscription = realtimeHelpers.subscribeToRoomPlayers(
      room.id,
      () => {
        loadRoomPlayers()
      }
    )

    return () => {
      realtimeHelpers.unsubscribe(subscription)
    }
  }, [room])

  const loadGames = async () => {
    try {
      const { data, error } = await gameHelpers.getAllGames()
      if (error) {
        console.error('Error loading games:', error)
        return
      }
      setGames(data || [])
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const loadRoomPlayers = async () => {
    if (!room) return
    
    try {
      const { data, error } = await roomHelpers.getRoomPlayers(room.id)
      if (error) {
        console.error('Error loading players:', error)
        return
      }
      setPlayers(data || [])
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const handleCreateRoom = async () => {
    if (!user || !roomName.trim() || !playerName.trim()) return

    try {
      setLoading(true)
      setError(null)

      // Generar código único para la sala
      const roomCode = generateRoomCode()

      // Crear la sala
      const { data: roomData, error: roomError } = await roomHelpers.createRoom(
        roomName.trim(),
        roomCode,
        user.id,
        maxPlayers
      )

      if (roomError) {
        setError('Error al crear la sala')
        console.error('Room error:', roomError)
        return
      }

      // Unirse como host
      const { data: playerData, error: playerError } = await roomHelpers.joinRoom(
        roomData.id,
        playerName.trim(),
        selectedAvatar,
        true // es host
      )

      if (playerError) {
        setError('Error al unirse a la sala')
        console.error('Player error:', playerError)
        return
      }

      setRoom(roomData)
      setPlayers([playerData])
      setCurrentStep('waiting')
    } catch (err) {
      setError('Error inesperado al crear la sala')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyRoomCode = async () => {
    if (!room) return

    try {
      await navigator.clipboard.writeText(room.code)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Error copying to clipboard:', err)
    }
  }

  const handleGameSelectedForSetup = async (game: Game) => {
    // Cargar el juego completo con preguntas
    try {
      setLoading(true)
      const { data: fullGameData, error: gameError } = await gameHelpers.getGameWithQuestions(game.id)
      
      if (gameError || !fullGameData) {
        setError('Error al cargar el juego completo')
        console.error('Game loading error:', gameError)
        return
      }
      
      setSelectedGame(fullGameData)
      setCurrentStep('setup')
    } catch (err) {
      setError('Error al cargar el juego')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStartGame = async () => {
    if (!room || !players.length || !selectedGame) return

    try {
      setLoading(true)
      setError(null)
      
      // Almacenar el juego en localStorage como fallback
      localStorage.setItem(`game-data-${room.id}`, JSON.stringify(selectedGame))
      
      // También usar Broadcast Channel para compartir en tiempo real
      const gameChannel = new BroadcastChannel(`game-${room.id}`)
      gameChannel.postMessage({
        type: 'GAME_DATA',
        game: selectedGame
      })
      
      // Escuchar solicitudes de datos del juego y responder
      gameChannel.onmessage = (event) => {
        if (event.data.type === 'REQUEST_GAME_DATA') {
          console.log('📡 Game data requested via broadcast, sending:', selectedGame.title)
          gameChannel.postMessage({
            type: 'GAME_DATA',
            game: selectedGame
          })
        }
      }
      
      // Mantener el canal abierto por un tiempo para responder a solicitudes
      setTimeout(() => {
        gameChannel.close()
      }, 10000)
      
      // Crear sesión de juego (método original)
      const { error: sessionError } = await roomHelpers.createGameSession(
        room.id, 
        selectedGame.id
      )
      
      if (sessionError) {
        setError('Error al crear la sesión de juego')
        console.error('Session error:', sessionError)
        return
      }
      
      // Actualizar estado de la sala a 'playing'
      const { error: roomError } = await roomHelpers.updateRoomStatus(room.id, 'playing')
      
      if (roomError) {
        setError('Error al iniciar el juego')
        console.error('Room error:', roomError)
        return
      }
      
      // Navegar a la sala de juego con el juego completo
      const hostPlayer = players.find(p => p.is_host)
      if (hostPlayer) {
        const updatedRoom = { 
          ...room, 
          status: 'playing' as const, 
          game: selectedGame, // Juego con preguntas
          current_game_data: selectedGame // Respaldo
        }
        console.log('🎯 Passing game to MultiplayerRoom:', selectedGame.title, 'Questions:', selectedGame.questions?.length)
        onJoinRoom(updatedRoom, hostPlayer)
      }
    } catch (err) {
      setError('Error al iniciar el juego')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }


  // Renderizar selector de juegos (paso inicial)
  if (currentStep === 'game-select') {
    return (
      <GameSelector
        games={games}
        onSelectGame={handleGameSelectedForSetup}
        onBack={onBack}
        title="Selecciona un Juego para tu Sala"
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="text-dominican-blue hover:text-dominican-blue-light"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">
              {currentStep === 'setup' ? 'Crear Nueva Sala' : 'Sala Creada'}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {currentStep === 'setup' ? (
          // Formulario de configuración
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-dominican-blue rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Configurar tu Sala
                </h2>
                <p className="text-gray-600 mb-4">
                  Personaliza los detalles de tu sala multijugador
                </p>
                
                {/* Juego seleccionado */}
                {selectedGame && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                        <Play className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-bold text-green-800">{selectedGame.title}</h3>
                        <p className="text-sm text-green-600">
                          {selectedGame.questions?.length || 0} preguntas
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {/* Nombre de la sala */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nombre de la Sala *
                  </label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                    placeholder="Ej: Trivia de los Viernes"
                    maxLength={50}
                  />
                </div>

                {/* Nombre del jugador */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tu Nombre *
                  </label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                    placeholder="Como te verán otros jugadores"
                    maxLength={30}
                  />
                </div>

                {/* Selección de avatar */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tu Avatar
                  </label>
                  <div className="grid grid-cols-6 gap-3">
                    {AVAILABLE_AVATARS.map((avatar) => (
                      <button
                        key={avatar}
                        onClick={() => setSelectedAvatar(avatar)}
                        className={`p-2 rounded-lg border-2 transition-all hover:scale-105 ${
                          selectedAvatar === avatar
                            ? 'border-dominican-blue bg-blue-50 ring-2 ring-dominican-blue ring-opacity-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <PlayerAvatar avatar={avatar} size="md" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Número máximo de jugadores */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Máximo de Jugadores
                  </label>
                  <select
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(Number(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                  >
                    {[5, 10, 15, 20].map(num => (
                      <option key={num} value={num}>{num} jugadores</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleCreateRoom}
                disabled={!roomName.trim() || !playerName.trim() || loading}
                className="w-full mt-8 btn-dominican-primary disabled:opacity-50"
              >
                {loading ? 'Creando Sala...' : 'Crear Sala'}
              </button>
            </div>
          </div>
        ) : (
          // Sala de espera
          <div className="max-w-4xl mx-auto">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Información de la sala */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-lg p-8">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">
                      {room?.name}
                    </h2>
                    <div className="flex items-center justify-center gap-4">
                      <div className="bg-dominican-blue text-white px-4 py-2 rounded-lg font-bold text-xl">
                        {room?.code}
                      </div>
                      <button
                        onClick={handleCopyRoomCode}
                        className="flex items-center gap-2 text-dominican-blue hover:text-dominican-blue-light"
                      >
                        <Copy className="w-5 h-5" />
                        {copySuccess ? '¡Copiado!' : 'Copiar'}
                      </button>
                    </div>
                    <p className="text-gray-600 mt-2">
                      Comparte este código para que otros se unan
                    </p>
                  </div>

                  {/* Lista de jugadores */}
                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">
                      Jugadores ({players.length}/{maxPlayers})
                    </h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      {players.map((player) => (
                        <div
                          key={player.id}
                          className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg"
                        >
                          <PlayerAvatar avatar={player.avatar} size="md" />
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800">
                              {player.name}
                              {player.is_host && (
                                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                  HOST
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                      
                      {/* Slots vacíos */}
                      {Array.from({ length: Math.max(0, maxPlayers - players.length) }).map((_, index) => (
                        <div key={index} className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg">
                          <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                          <p className="text-gray-500">Esperando jugador...</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Controles del host */}
                  <div className="flex gap-4">
                    <button
                      onClick={handleStartGame}
                      disabled={players.length < 2 || loading}
                      className="btn-dominican-primary flex-1 disabled:opacity-50"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      {loading ? 'Iniciando...' : 'Iniciar Juego'}
                    </button>
                    
                    <button className="btn-dominican-outline">
                      <Settings className="w-5 h-5 mr-2" />
                      Configurar
                    </button>
                  </div>
                  
                  {players.length < 2 && (
                    <p className="text-center text-gray-500 text-sm mt-4">
                      Necesitas al menos 2 jugadores para iniciar
                    </p>
                  )}
                </div>
              </div>

              {/* Panel lateral con instrucciones */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">
                    📱 Cómo Jugar
                  </h3>
                  
                  <div className="space-y-4 text-sm">
                    <div className="flex gap-3">
                      <span className="bg-dominican-blue text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">1</span>
                      <p className="text-gray-600">
                        Comparte el código <strong>{room?.code}</strong> con tus amigos
                      </p>
                    </div>
                    
                    <div className="flex gap-3">
                      <span className="bg-dominican-blue text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</span>
                      <p className="text-gray-600">
                        Espera a que se unan (mínimo 2 jugadores)
                      </p>
                    </div>
                    
                    <div className="flex gap-3">
                      <span className="bg-dominican-blue text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">3</span>
                      <p className="text-gray-600">
                        Selecciona un juego y ¡comienza la diversión!
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-800 text-sm">
                      💡 <strong>Consejo:</strong> Como host, puedes iniciar el juego cuando estés listo. Todos los jugadores verán las preguntas al mismo tiempo.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CreateRoom