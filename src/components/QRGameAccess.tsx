import React, { useState, useEffect } from 'react'
import { QrCode, Search, Play, ArrowLeft } from 'lucide-react'
import { qrHelpers, qrResultsHelpers } from '../insforge'
import { QRGameSession, Game, isValidQRCode } from '../types'
import SinglePlayerGame from './SinglePlayerGame'

interface QRGameAccessProps {
  onBack: () => void
}

const QRGameAccess: React.FC<QRGameAccessProps> = ({ onBack }) => {
  // Estados principales
  const [accessCode, setAccessCode] = useState('')
  const [qrSession, setQRSession] = useState<QRGameSession | null>(null)
  const [currentGame, setCurrentGame] = useState<Game | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)
  
  // Estados de la UI
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Verificar si llegamos desde una URL con código QR
  useEffect(() => {
    const hash = window.location.hash
    const qrMatch = hash.match(/qr-game\/([A-Z0-9]+)/)
    
    if (qrMatch && qrMatch[1]) {
      const codeFromURL = qrMatch[1]
      setAccessCode(codeFromURL)
      handleAccessGame(codeFromURL)
    }
  }, [])

  const handleAccessGame = async (code?: string) => {
    const codeToUse = code || accessCode.trim().toUpperCase()
    
    if (!codeToUse) {
      setError('Por favor ingresa un código de acceso')
      return
    }

    if (!isValidQRCode(codeToUse)) {
      setError('El código debe tener 10 caracteres (letras y números)')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: qrError } = await qrHelpers.findQRSession(codeToUse)

      if (qrError) {
        if (qrError.code === 'PGRST116') {
          setError('No se encontró ninguna sesión con ese código')
        } else {
          setError('Error al buscar la sesión')
        }
        console.error('QR session error:', qrError)
        return
      }

      if (!data.is_active) {
        setError('Esta sesión QR ha sido desactivada')
        return
      }

      console.log('QR Session data:', data)
      console.log('Game from session:', data.games || data.game)
      
      setQRSession(data)
      // La respuesta de la API viene con 'games' (plural), no 'game'
      const gameData = data.games || data.game
      setCurrentGame(gameData)
      
      if (!gameData) {
        setError('No se pudo cargar el juego asociado a esta sesión')
        return
      }
    } catch (err) {
      setError('Error inesperado al acceder a la sesión')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStartGame = () => {
    console.log('Starting game with data:', currentGame)
    if (!currentGame) {
      setError('No hay juego disponible para esta sesión')
      return
    }
    
    // Mostrar input de nombre antes de iniciar el juego
    setShowNameInput(true)
  }

  const handleNameSubmitAndStart = async () => {
    if (!playerName.trim()) {
      setError('Por favor ingresa tu nombre')
      return
    }

    if (!qrSession?.id) {
      setError('Error: No se pudo identificar la sesión QR')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Verificar si el jugador ya participó en esta sesión
      const { data: existingResults, error: checkError } = await qrResultsHelpers.checkPlayerPlayed(
        qrSession.id,
        playerName.trim()
      )

      if (checkError) {
        console.error('Error checking if player already played:', checkError)
        // Si hay error verificando, permitir continuar
      } else if (existingResults && existingResults.length > 0) {
        setError(`El nombre "${playerName.trim()}" ya participó en esta sesión. Por favor usa un nombre diferente.`)
        return
      }

      setShowNameInput(false)
      setGameStarted(true)
    } catch (err) {
      console.error('Error checking player participation:', err)
      setError('Error al verificar participación. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleGameEnd = () => {
    setGameStarted(false)
  }

  const handleCodeChange = (value: string) => {
    // Convertir a mayúsculas y filtrar solo letras y números
    const cleanValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
    setAccessCode(cleanValue)
  }

  // Cabecera común: azul con la franja de la bandera
  const header = (onLeave: () => void) => (
    <header className="bg-dominican-blue text-white shadow-md">
      <div className="flex items-center gap-3 px-4 py-3 max-w-4xl mx-auto">
        <button
          onClick={onLeave}
          className="flex items-center gap-1.5 text-sm font-bold text-white/85 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver
        </button>
        <p className="flex-1 text-center font-display text-lg leading-tight truncate pr-16">
          {qrSession?.title || 'Acceso por QR'}
        </p>
      </div>
      {/* franja de la bandera */}
      <div className="h-1 bg-white" />
      <div className="h-1.5 bg-dominican-red" />
    </header>
  )

  const primaryButton = 'w-full flex items-center justify-center gap-2 bg-dominican-red hover:bg-dominican-red-light text-white font-display text-2xl py-4 rounded-2xl shadow-[0_6px_0_#A50E1E] transition-all active:translate-y-1 active:shadow-[0_2px_0_#A50E1E] disabled:opacity-50 disabled:cursor-not-allowed'

  const gameFacts = (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-arena p-4 rounded-2xl text-center">
        <div className="font-display text-4xl text-dominican-red">{currentGame?.questions?.length || 0}</div>
        <p className="text-gray-600 font-bold text-sm">Preguntas</p>
      </div>
      <div className="bg-arena p-4 rounded-2xl text-center">
        <div className="font-display text-4xl text-dominican-red">
          ~{Math.ceil((currentGame?.questions?.reduce((acc, q) => acc + q.time_limit, 0) || 0) / 60)}
        </div>
        <p className="text-gray-600 font-bold text-sm">Minutos</p>
      </div>
    </div>
  )

  // Si está mostrando el input de nombre
  if (showNameInput && qrSession && currentGame) {
    const leaveNameInput = () => {
      setShowNameInput(false)
      setPlayerName('')
      setError(null)
    }

    return (
      <div className="min-h-screen flex flex-col fondo-caribe text-dominican-blue-dark">
        {header(leaveNameInput)}

        <main className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-4 py-6">
          <div className="w-full bg-white rounded-2xl shadow-xl border-t-8 border-dominican-red p-6 sm:p-8">
            <div className="text-center mb-6">
              <h2 className="font-display text-3xl text-dominican-blue">¿Cómo te llamas?</h2>
              <p className="text-gray-600 font-semibold text-sm">
                Con ese nombre saldrás en la tabla de posiciones
              </p>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 bg-dominican-red text-white rounded-xl font-semibold text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full p-4 text-center text-xl font-bold bg-arena border-2 border-dominican-blue/20 rounded-2xl focus:outline-none focus:border-dominican-blue"
                placeholder="Tu nombre"
                aria-label="Tu nombre"
                maxLength={30}
                onKeyPress={(e) => e.key === 'Enter' && handleNameSubmitAndStart()}
                autoFocus
              />

              <button
                onClick={handleNameSubmitAndStart}
                disabled={!playerName.trim() || loading}
                className={primaryButton}
              >
                <Play className="w-6 h-6" />
                {loading ? 'Verificando…' : '¡Arrancar!'}
              </button>
            </div>

            <div className="mt-6">{gameFacts}</div>
          </div>
        </main>
      </div>
    )
  }

  // Si el juego ha comenzado, mostrar el componente de juego
  if (gameStarted && currentGame) {
    return (
      <SinglePlayerGame
        game={currentGame}
        onBack={handleGameEnd}
        isQRSession={true}
        qrSessionTitle={qrSession?.title}
        qrSessionId={qrSession?.id}
        playerName={playerName}
      />
    )
  }

  return (
    <div className="min-h-screen flex flex-col fondo-caribe text-dominican-blue-dark">
      {header(onBack)}

      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-4 py-6">
        {/* Mensaje de error */}
        {error && (
          <div className="w-full mb-4 px-4 py-3 bg-dominican-red text-white rounded-xl font-semibold text-sm">
            {error}
          </div>
        )}

        {!qrSession ? (
          // Formulario de acceso
          <div className="w-full bg-white rounded-2xl shadow-xl border-t-8 border-dominican-red p-6 sm:p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-dominican-blue rounded-2xl flex items-center justify-center mx-auto mb-3">
                <QrCode className="w-9 h-9 text-white" />
              </div>
              <h2 className="font-display text-3xl text-dominican-blue">Entra con tu código</h2>
              <p className="text-gray-600 font-semibold text-sm">
                Escanea el QR con la cámara o escribe el código de 10 caracteres
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={accessCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                className="w-full p-4 text-center font-display text-3xl tracking-widest text-dominican-blue bg-arena border-2 border-dominican-blue/20 rounded-2xl focus:outline-none focus:border-dominican-blue"
                placeholder="ABC123DEF0"
                aria-label="Código de acceso"
                maxLength={10}
              />

              <button
                onClick={() => handleAccessGame()}
                disabled={!accessCode.trim() || accessCode.length !== 10 || loading}
                className={primaryButton}
              >
                <Search className="w-6 h-6" />
                {loading ? 'Buscando…' : 'Buscar el juego'}
              </button>
            </div>

            <div className="mt-6 p-4 bg-arena rounded-2xl text-sm text-gray-700 space-y-1">
              <p><strong>iPhone:</strong> abre la cámara, apunta al QR y toca el aviso.</p>
              <p><strong>Android:</strong> usa la cámara en modo QR o Google Lens.</p>
            </div>
          </div>
        ) : (
          // Vista previa del juego encontrado
          <div className="w-full bg-white rounded-2xl shadow-xl border-t-8 border-dominican-red p-6 sm:p-8 text-center">
            <p className="font-display text-xl text-palma">¡Lo encontramos!</p>
            <h2 className="font-display text-3xl sm:text-4xl text-dominican-blue mb-1">
              {currentGame?.title}
            </h2>

            {qrSession.description && (
              <p className="text-gray-600 font-semibold mb-2">
                {qrSession.description}
              </p>
            )}

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-5">
              Código <span className="font-mono">{qrSession.access_code}</span>
            </p>

            {gameFacts}

            <button onClick={handleStartGame} className={`${primaryButton} mt-6`}>
              <Play className="w-6 h-6" />
              ¡Vamos a jugar!
            </button>

            <p className="mt-5 text-sm text-gray-600 font-semibold">
              Juegas por tu cuenta: ganas más puntos mientras más rápido aciertes.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

export default QRGameAccess
