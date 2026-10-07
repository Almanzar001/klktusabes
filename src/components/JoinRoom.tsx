import React, { useState } from 'react'
import { ArrowLeft, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { roomHelpers, testConnection } from '../insforge'
import { Room, Player, AVAILABLE_AVATARS, isValidRoomCode } from '../types'
import PlayerAvatar from './PlayerAvatar'

interface JoinRoomProps {
  onBack: () => void
  onJoinRoom: (room: Room, player: Player) => void
}

const JoinRoom: React.FC<JoinRoomProps> = ({ onBack, onJoinRoom }) => {
  const { userProfile } = useAuth()
  
  // Estados del formulario
  const [roomCode, setRoomCode] = useState('')
  const [playerName, setPlayerName] = useState(userProfile?.full_name || '')
  const [selectedAvatar, setSelectedAvatar] = useState(AVAILABLE_AVATARS[0])
  
  // Estados de la UI
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleJoinRoom = async () => {
    if (!roomCode.trim() || !playerName.trim()) {
      setError('Por favor completa todos los campos')
      return
    }

    if (!isValidRoomCode(roomCode.trim())) {
      setError('El código debe tener 6 dígitos')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Buscar la sala por código
      const { data: roomData, error: roomError } = await roomHelpers.findRoomByCode(roomCode.trim())

      if (roomError) {
        console.error('🔴 Room search error details:', roomError)
        
        if (roomError.code === 'PGRST116' || 
            roomError.message?.includes('No rows found') || 
            roomError.code === 'ROOM_NOT_FOUND') {
          setError('No se encontró ninguna sala con ese código. Verifica que el código sea correcto.')
        } else if (roomError.message?.includes('duplicate') || roomError.code === '23505') {
          setError('Ya estás en esta sala')
        } else if (roomError.message?.includes('permission') || roomError.code?.includes('RLS')) {
          setError('No tienes permisos para acceder a esta sala')
        } else if (roomError.message?.includes('network') || roomError.message?.includes('fetch')) {
          setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
        } else {
          setError(`Error al buscar la sala: ${roomError.message || 'Error desconocido'}`)
        }
        return
      }

      if (!roomData) {
        setError('No se encontró ninguna sala con ese código')
        return
      }

      // Verificar que la sala esté disponible
      if (roomData.status !== 'waiting') {
        setError('Esta sala ya comenzó o terminó')
        return
      }

      // Verificar si hay espacio en la sala
      const currentPlayers = roomData.players?.length || 0
      if (currentPlayers >= roomData.max_players) {
        setError('La sala está llena')
        return
      }

      // Verificar si el nombre ya está en uso
      const nameInUse = roomData.players?.some((player: any) => 
        player.name.toLowerCase() === playerName.trim().toLowerCase()
      )
      
      if (nameInUse) {
        setError('Ya hay un jugador con ese nombre en la sala')
        return
      }

      // Unirse a la sala
      const { data: playerData, error: playerError } = await roomHelpers.joinRoom(
        roomData.id,
        playerName.trim(),
        selectedAvatar,
        false // no es host
      )

      if (playerError) {
        setError('Error al unirse a la sala')
        console.error('Player error:', playerError)
        return
      }

      // Navegar a la sala de juego
      onJoinRoom(roomData, playerData)
    } catch (err) {
      setError('Error inesperado al unirse a la sala')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRoomCodeChange = (value: string) => {
    // Solo permitir números y limitar a 6 dígitos
    const numericValue = value.replace(/\D/g, '').slice(0, 6)
    setRoomCode(numericValue)
  }

  const handleTestConnection = async () => {
    setError('Probando conexión...')
    const result = await testConnection()
    if (result.success) {
      setError(`✅ Conexión exitosa! Salas en BD: ${result.count || 0}`)
    } else {
      setError(`❌ Error de conexión: ${(result.error as any)?.message || 'Error desconocido'}`)
    }
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
            <h1 className="text-2xl font-bold text-gray-800">Unirse a Sala</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Mensaje de error */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-dominican-red rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Únete a la Diversión
            </h2>
            <p className="text-gray-600">
              Introduce el código de la sala para empezar a jugar
            </p>
          </div>

          <div className="space-y-6">
            {/* Código de la sala */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Código de la Sala *
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => handleRoomCodeChange(e.target.value)}
                className="w-full p-4 text-center text-2xl font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue tracking-widest"
                placeholder="123456"
                maxLength={6}
                inputMode="numeric"
              />
              <p className="text-xs text-gray-500 mt-1 text-center">
                Código de 6 dígitos proporcionado por el host
              </p>
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
          </div>

          {/* Vista previa del jugador */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-sm font-semibold text-gray-700 mb-2">Vista previa:</p>
            <div className="flex items-center gap-3">
              <PlayerAvatar avatar={selectedAvatar} size="lg" />
              <div>
                <p className="font-semibold text-gray-800">
                  {playerName || 'Tu nombre'}
                </p>
                <p className="text-sm text-gray-600">Jugador</p>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <button
              onClick={handleJoinRoom}
              disabled={!roomCode.trim() || !playerName.trim() || roomCode.length !== 6 || loading}
              className="w-full btn-dominican-primary disabled:opacity-50"
            >
              {loading ? 'Uniéndose...' : 'Unirse a la Sala'}
            </button>
            
            {/* Botón temporal para probar conexión */}
            <button
              onClick={handleTestConnection}
              className="w-full btn-dominican-outline text-sm"
            >
              🔧 Probar Conexión a Base de Datos
            </button>
          </div>

          {/* Instrucciones */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">
              💡 ¿Cómo obtener el código de sala?
            </h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Pídeselo al host (creador de la sala)</li>
              <li>• El código tiene exactamente 6 dígitos</li>
              <li>• Asegúrate de que la sala aún esté esperando jugadores</li>
              <li>• Tu nombre debe ser único en la sala</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default JoinRoom