import React, { useState, useEffect } from 'react'
import { Trophy, RefreshCw, ArrowLeft, Crown } from 'lucide-react'
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

  // Oro, plata y bronce para los tres primeros
  const rankBadge = (rank: number) => {
    const color =
      rank === 1 ? 'bg-yellow-400 text-dominican-blue-dark'
      : rank === 2 ? 'bg-slate-300 text-dominican-blue-dark'
      : rank === 3 ? 'bg-amber-600 text-white'
      : 'bg-white text-dominican-blue'

    return (
      <span className={`${color} w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-display text-xl shadow`}>
        {rank === 1 ? <Crown className="w-5 h-5" /> : rank}
      </span>
    )
  }

  const formatTime = (seconds: number) => {
    return `${seconds.toFixed(1)}s`
  }

  const formatAccuracy = (correct: number, total: number) => {
    return total > 0 ? `${Math.round((correct / total) * 100)}%` : '0%'
  }

  if (loading) {
    return (
      <div className="min-h-screen fondo-caribe flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <h2 className="font-bold text-dominican-blue">Cargando la tabla de posiciones…</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col fondo-caribe text-dominican-blue-dark">
      <header className="bg-dominican-blue text-white shadow-md">
        <div className="flex items-center justify-between gap-3 px-4 py-3 max-w-4xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-bold text-white/85 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver
          </button>
          <div className="text-center min-w-0">
            <p className="font-display text-lg leading-tight truncate">Tabla de posiciones</p>
            <p className="text-xs font-semibold text-white/80 truncate">{sessionTitle}</p>
          </div>
          <button
            onClick={fetchLeaderboard}
            className="p-1.5 rounded-full bg-white/15 hover:bg-white/25"
            title="Actualizar"
            aria-label="Actualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {/* franja de la bandera */}
        <div className="h-1 bg-white" />
        <div className="h-1.5 bg-dominican-red" />
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-4 pb-6 space-y-4">
        {error ? (
          <div className="px-4 py-3 bg-dominican-red text-white rounded-xl font-semibold text-sm">
            {error}
          </div>
        ) : (
          <>
            <h2 className="flex items-center justify-center gap-3 font-display text-4xl text-dominican-blue">
              <Trophy className="w-9 h-9 text-ambar" />
              ¡Los duros!
            </h2>

            {/* Estadísticas generales */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white rounded-2xl shadow-lg p-3">
                <div className="font-display text-3xl text-dominican-red tabular-nums">{leaderboard.length}</div>
                <div className="text-xs font-bold text-gray-600">Participantes</div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-3">
                <div className="font-display text-3xl text-palma tabular-nums">{leaderboard[0]?.total_score || 0}</div>
                <div className="text-xs font-bold text-gray-600">Mejor puntuación</div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-3">
                <div className="font-display text-3xl text-larimar tabular-nums">
                  {leaderboard.length > 0
                    ? Math.round(leaderboard.reduce((acc, entry) => acc + entry.total_score, 0) / leaderboard.length)
                    : 0}
                </div>
                <div className="text-xs font-bold text-gray-600">Promedio</div>
              </div>
            </div>

            {/* Tabla de posiciones */}
            {leaderboard.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-bold">Aún no hay resultados en esta sesión</p>
                <p className="text-sm text-gray-600">¡Sé el primero en jugar!</p>
              </div>
            ) : (
              <ol className="space-y-2">
                {leaderboard.map((entry) => {
                  const isCurrentPlayer = !!currentPlayerName && entry.player_name === currentPlayerName

                  return (
                    <li
                      key={`${entry.player_name}-${entry.total_score}`}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-3 shadow ${
                        isCurrentPlayer ? 'bg-dominican-blue text-white' : 'bg-white'
                      }`}
                    >
                      {rankBadge(entry.rank)}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">
                          {entry.player_name}
                          {isCurrentPlayer && (
                            <span className="ml-2 text-xs bg-white text-dominican-blue px-2 py-0.5 rounded-full">
                              Tú
                            </span>
                          )}
                        </p>
                        <p className={`text-xs font-semibold ${isCurrentPlayer ? 'text-white/80' : 'text-gray-600'}`}>
                          {formatAccuracy(entry.total_correct, entry.total_questions)} de precisión
                          {entry.avg_time > 0 && ` · ${formatTime(entry.avg_time)} promedio`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-display text-2xl tabular-nums">{entry.total_score}</div>
                        <div className={`text-[10px] font-bold uppercase ${isCurrentPlayer ? 'text-white/80' : 'text-gray-500'}`}>puntos</div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}

            {/* Acciones */}
            <div className="flex flex-wrap gap-3 pt-2">
              {onPlayAgain && (
                <button
                  onClick={onPlayAgain}
                  className="flex-1 min-w-[10rem] bg-dominican-red hover:bg-dominican-red-light text-white font-display text-xl px-6 py-3 rounded-2xl shadow-[0_5px_0_#A50E1E] transition-all active:translate-y-1 active:shadow-[0_1px_0_#A50E1E]"
                >
                  Jugar de nuevo
                </button>
              )}

              <button
                onClick={onBack}
                className="flex-1 min-w-[10rem] bg-dominican-blue hover:bg-dominican-blue-light text-white font-display text-xl px-6 py-3 rounded-2xl shadow-[0_5px_0_#001A3A] transition-all active:translate-y-1 active:shadow-[0_1px_0_#001A3A]"
              >
                Volver a mis resultados
              </button>
            </div>

            <p className="text-center text-sm text-gray-600 font-semibold">
              Toca actualizar para ver los resultados de quienes terminen después.
            </p>
          </>
        )}
      </main>
    </div>
  )
}

export default QRLeaderboard
