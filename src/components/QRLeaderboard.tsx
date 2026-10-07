import React, { useState, useEffect } from 'react'
import { Trophy, Medal, Award, RefreshCw, ArrowLeft, Crown } from 'lucide-react'
import { insforge } from '../insforge'

interface LeaderboardEntry {
  player_name: string
  total_score: number
  total_correct: number
  total_questions: number
  avg_time: number
  rank: number
}

interface QRLeaderboardProps {
  qrSessionId: string
  sessionTitle: string
  currentPlayerName?: string
  onBack: () => void
  onPlayAgain?: () => void
}

const QRLeaderboard: React.FC<QRLeaderboardProps> = ({
  qrSessionId,
  sessionTitle,
  currentPlayerName,
  onBack,
  onPlayAgain
}) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('Fetching leaderboard for QR session:', qrSessionId)

      // Consulta mejorada con validación de sesión activa
      const { data, error: fetchError } = await insforge.database
        .from('qr_session_results')
        .select(`
          *,
          qr_game_sessions!inner(
            is_active,
            expires_at
          )
        `)
        .eq('qr_session_id', qrSessionId)
        .eq('qr_game_sessions.is_active', true)
        .order('total_score', { ascending: false })
        .order('avg_time', { ascending: true })
        .order('completed_at', { ascending: true })
        .limit(10)

      console.log('Leaderboard fetch result:', { data, fetchError })

      if (fetchError) {
        console.error('Error fetching leaderboard:', fetchError)
        
        // Verificar si es un error de tabla no encontrada
        if (fetchError.code === '42P01') {
          setError('La tabla de resultados no existe. Por favor ejecuta la migración de base de datos.')
        } else {
          setError(`Error al cargar el leaderboard: ${fetchError.message}`)
        }
        return
      }

      const processedData = data?.map((entry, index) => ({
        ...entry,
        rank: index + 1
      })) || []

      setLeaderboard(processedData)
    } catch (err) {
      console.error('Error:', err)
      setError('Error inesperado al cargar el leaderboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaderboard()
  }, [qrSessionId])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />
      case 3:
        return <Award className="w-6 h-6 text-orange-600" />
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-gray-600 font-bold">{rank}</span>
    }
  }

  const getRankStyle = (rank: number, isCurrentPlayer: boolean) => {
    const baseStyle = "flex items-center gap-4 p-4 rounded-lg border transition-all duration-200"
    
    if (isCurrentPlayer) {
      return `${baseStyle} bg-blue-50 border-blue-300 ring-2 ring-blue-200`
    }
    
    switch (rank) {
      case 1:
        return `${baseStyle} bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300`
      case 2:
        return `${baseStyle} bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300`
      case 3:
        return `${baseStyle} bg-gradient-to-r from-orange-50 to-orange-100 border-orange-300`
      default:
        return `${baseStyle} bg-white border-gray-200 hover:bg-gray-50`
    }
  }

  const formatTime = (seconds: number) => {
    return `${seconds.toFixed(1)}s`
  }

  const formatAccuracy = (correct: number, total: number) => {
    return total > 0 ? `${Math.round((correct / total) * 100)}%` : '0%'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800">Cargando Leaderboard...</h2>
        </div>
      </div>
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
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-800">Leaderboard</h1>
              <p className="text-gray-600">{sessionTitle}</p>
            </div>
            <button
              onClick={fetchLeaderboard}
              className="text-gray-600 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100"
              title="Actualizar"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        ) : (
          <>
            {/* Estadísticas generales */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Trophy className="w-6 h-6 text-yellow-500" />
                <h2 className="text-xl font-bold text-gray-800">Mejores Puntuaciones</h2>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4 text-center">
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{leaderboard.length}</div>
                  <div className="text-sm text-purple-800">Participantes</div>
                </div>
                
                {leaderboard.length > 0 && (
                  <>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{leaderboard[0]?.total_score || 0}</div>
                      <div className="text-sm text-green-800">Mejor Puntuación</div>
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {Math.round(leaderboard.reduce((acc, entry) => acc + entry.total_score, 0) / leaderboard.length)}
                      </div>
                      <div className="text-sm text-blue-800">Promedio</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Tabla de posiciones */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                <h3 className="text-xl font-bold">Tabla de Posiciones</h3>
                <p className="text-purple-100">Los mejores jugadores de esta sesión</p>
              </div>

              {leaderboard.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Aún no hay resultados en esta sesión</p>
                  <p className="text-sm">¡Sé el primero en jugar!</p>
                </div>
              ) : (
                <div className="p-6 space-y-3">
                  {leaderboard.map((entry) => {
                    const isCurrentPlayer = currentPlayerName && entry.player_name === currentPlayerName
                    
                    return (
                      <div
                        key={`${entry.player_name}-${entry.total_score}`}
                        className={getRankStyle(entry.rank, !!isCurrentPlayer)}
                      >
                        <div className="flex items-center gap-3">
                          {getRankIcon(entry.rank)}
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-800">
                              {entry.player_name}
                              {isCurrentPlayer && (
                                <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
                                  Tú
                                </span>
                              )}
                            </h4>
                            <div className="text-sm text-gray-600">
                              {formatAccuracy(entry.total_correct, entry.total_questions)} de precisión
                              {entry.avg_time > 0 && ` • ${formatTime(entry.avg_time)} promedio`}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-gray-800">
                              {entry.total_score}
                            </div>
                            <div className="text-xs text-gray-500">puntos</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="mt-8 flex gap-4 justify-center">
              {onPlayAgain && (
                <button
                  onClick={onPlayAgain}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105"
                >
                  🎮 Jugar de Nuevo
                </button>
              )}
              
              <button
                onClick={onBack}
                className="btn-dominican-outline py-3 px-6"
              >
                Volver al Juego
              </button>
            </div>

            {/* Información adicional */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
              <p className="text-blue-800 text-sm">
                💡 <strong>Tip:</strong> El leaderboard se actualiza automáticamente cuando otros jugadores completan el juego.
                Comparte el código QR para que más personas participen.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default QRLeaderboard