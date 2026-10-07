import React, { useState, useEffect } from 'react'
import { Users, Play, ArrowLeft, Gamepad2, Presentation } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { roomHelpers, gameHelpers } from '../insforge'
import { Game, Room, Player, generateRoomCode, AVAILABLE_AVATARS } from '../types'
import GameSelector from './GameSelector'
import PlayerAvatar from './PlayerAvatar'

interface CreateRoomProps {
  onBack: () => void
  // player es null cuando quien crea la sala solo dirige la partida
  onJoinRoom: (room: Room, player: Player | null) => void
}

const CreateRoom: React.FC<CreateRoomProps> = ({ onBack, onJoinRoom }) => {
  const { user, userProfile } = useAuth()
  
  // Estados principales
  const [currentStep, setCurrentStep] = useState<'game-select' | 'setup'>('game-select')
  const [games, setGames] = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  
  // Estados del formulario
  const [roomName, setRoomName] = useState('')
  const [playerName, setPlayerName] = useState(userProfile?.full_name || '')
  const [selectedAvatar, setSelectedAvatar] = useState(AVAILABLE_AVATARS[0])
  const [maxPlayers, setMaxPlayers] = useState(10)
  // Quien crea la sala puede jugar o solo dirigir la partida (por ejemplo, un profesor)
  const [hostPlays, setHostPlays] = useState(true)
  
  // Estados de la UI
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cargar juegos disponibles
  useEffect(() => {
    loadGames()
  }, [])

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

  const handleCreateRoom = async () => {
    if (!user || !selectedGame || !roomName.trim() || (hostPlays && !playerName.trim())) return

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

      // Unirse como host, salvo que solo vaya a dirigir la partida
      let hostPlayer: Player | null = null

      if (hostPlays) {
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

        hostPlayer = playerData
      }

      // Dejar el juego elegido asociado a la sala para que todos los jugadores lo carguen
      const { error: sessionError } = await roomHelpers.createGameSession(
        roomData.id,
        selectedGame.id
      )

      if (sessionError) {
        setError('Error al crear la sesión de juego')
        console.error('Session error:', sessionError)
        return
      }

      // La sala de espera y la partida continúan en la sala de juego
      onJoinRoom(roomData, hostPlayer)
    } catch (err) {
      setError('Error inesperado al crear la sala')
      console.error('Error:', err)
    } finally {
      setLoading(false)
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
              Crear Nueva Sala
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

        {/* Formulario de configuración */}
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

              {/* Participación de quien crea la sala */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ¿Cómo vas a participar?
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setHostPlays(true)}
                    aria-pressed={hostPlays}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      hostPlays
                        ? 'border-dominican-blue bg-blue-50 ring-2 ring-dominican-blue ring-opacity-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-bold text-gray-800">
                      <Gamepad2 className="w-5 h-5 text-dominican-blue" />
                      Voy a jugar
                    </span>
                    <span className="block text-sm text-gray-600 mt-1">
                      Respondes las preguntas y sales en la tabla de posiciones.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHostPlays(false)}
                    aria-pressed={!hostPlays}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      !hostPlays
                        ? 'border-dominican-blue bg-blue-50 ring-2 ring-dominican-blue ring-opacity-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-bold text-gray-800">
                      <Presentation className="w-5 h-5 text-dominican-blue" />
                      Solo dirijo la partida
                    </span>
                    <span className="block text-sm text-gray-600 mt-1">
                      Para profesores o presentadores: muestras las preguntas y controlas el ritmo, sin responder.
                    </span>
                  </button>
                </div>
              </div>

              {hostPlays && (
                <>
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

                </>
              )}

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
              disabled={!roomName.trim() || (hostPlays && !playerName.trim()) || loading}
              className="w-full mt-8 btn-dominican-primary disabled:opacity-50"
            >
              {loading ? 'Creando Sala...' : 'Crear Sala'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateRoom