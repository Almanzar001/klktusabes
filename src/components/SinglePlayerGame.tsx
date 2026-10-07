import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowLeft, Play, Check, X, RotateCcw, Trophy, Volume2, VolumeX } from 'lucide-react'
import { gameHelpers, qrResultsHelpers, insforge } from '../insforge'
import { Game, Question, calculatePoints } from '../types'
import GameSelector from './GameSelector'
import QRLeaderboard from './QRLeaderboard'
import AnswerBadge, { ANSWER_STYLES } from './AnswerBadge'
import QuestionMedia, { preloadQuestionImage } from './QuestionMedia'
import { useGameSounds } from '../hooks/useGameSounds'

interface SinglePlayerGameProps {
  onBack: () => void
  game?: Game
  isQRSession?: boolean
  qrSessionTitle?: string
  qrSessionId?: string
  playerName?: string
}

interface GameResult {
  totalQuestions: number
  correctAnswers: number
  totalPoints: number
  timeSpent: number
  accuracy: number
}

interface ShuffledQuestion extends Question {
  shuffledOptions: string[]
  correctAnswerIndex: number
}

// Tiempo que se muestra la pregunta antes de abrir las respuestas, y el resultado antes de avanzar
const INTRO_MS = 3000
const REVEAL_MS = 2500

// Función para mezclar array
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Función para mezclar opciones de una pregunta
const shuffleQuestionOptions = (question: Question): ShuffledQuestion => {
  const optionsWithIndex = question.options.map((option, index) => ({
    option,
    originalIndex: index
  }))

  const shuffledOptionsWithIndex = shuffleArray(optionsWithIndex)
  const shuffledOptions = shuffledOptionsWithIndex.map(item => item.option)

  // Encontrar el nuevo índice de la respuesta correcta
  const correctAnswerIndex = shuffledOptionsWithIndex.findIndex(
    item => item.originalIndex === question.correct_answer
  )

  return {
    ...question,
    shuffledOptions,
    correctAnswerIndex
  }
}

const SinglePlayerGame: React.FC<SinglePlayerGameProps> = ({
  onBack,
  game: initialGame,
  isQRSession = false,
  qrSessionTitle,
  qrSessionId,
  playerName: initialPlayerName
}) => {
  // Hook de sonidos
  const {
    playCorrect,
    playIncorrect,
    playTick,
    playTimeUp,
    playGameStart,
    playGameEnd,
    startMusic,
    stopMusic,
    toggleMute,
    isMuted,
    initializeAudio,
    isAudioEnabled
  } = useGameSounds()

  // Estados principales
  const [games, setGames] = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<Game | null>(initialGame || null)
  const [shuffledQuestions, setShuffledQuestions] = useState<ShuffledQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [gameState, setGameState] = useState<'select' | 'playing' | 'results' | 'leaderboard' | 'name-input'>('select')

  // Estados para sesiones QR
  const [playerName] = useState(initialPlayerName || '')
  const [, setSavingResults] = useState(false)
  const [qrResultsSaved, setQrResultsSaved] = useState(false) // Nueva bandera para evitar guardados múltiples

  // Estados del juego
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showIntro, setShowIntro] = useState(false) // se muestra la pregunta; las respuestas aún no se abren
  const [showAnswer, setShowAnswer] = useState(false)
  const [timeLeft, setTimeLeft] = useState(30)
  const [answers, setAnswers] = useState<Array<{
    questionIndex: number
    selectedAnswer: number
    isCorrect: boolean
    timeToAnswer: number
    pointsEarned: number
  }>>([])
  const [gameStartTime, setGameStartTime] = useState<number>(0)
  const [questionStartTime, setQuestionStartTime] = useState<number>(0)

  // Temporizadores pendientes, para cancelarlos al salir de la pantalla
  const pendingTimers = useRef<number[]>([])

  const later = (callback: () => void, delay: number) => {
    pendingTimers.current.push(window.setTimeout(callback, delay))
  }

  useEffect(() => {
    return () => {
      pendingTimers.current.forEach(window.clearTimeout)
      stopMusic()
    }
  }, [stopMusic])

  const calculateResults = (): GameResult => {
    const totalQuestions = selectedGame?.questions?.length || 0
    const correctAnswers = answers.filter(a => a.isCorrect).length
    const totalPoints = answers.reduce((sum, a) => sum + a.pointsEarned, 0)
    const timeSpent = Math.round((Date.now() - gameStartTime) / 1000)
    const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0

    return {
      totalQuestions,
      correctAnswers,
      totalPoints,
      timeSpent,
      accuracy: Math.round(accuracy)
    }
  }

  // Función para guardar resultados de sesión QR
  const saveQRResults = useCallback(async (name: string) => {
    if (!isQRSession || !qrSessionId || !selectedGame) {
      console.log('Cannot save QR results - missing data:', { isQRSession, qrSessionId, selectedGame })
      return
    }

    // Si ya se guardaron los resultados, no volver a guardar
    if (qrResultsSaved) {
      console.log('QR results already saved, skipping...')
      return
    }

    // Normalizar nombre
    const normalizedName = name.trim()
    if (!normalizedName || normalizedName.length < 2) {
      console.error('Invalid player name:', name)
      alert('Nombre inválido. Debe tener al menos 2 caracteres.')
      return
    }

    setSavingResults(true)
    setQrResultsSaved(true) // Marcar como guardado antes de intentar
    try {
      // Verificar que la sesión QR esté activa
      const { data: sessionData, error: sessionError } = await insforge.database
        .from('qr_game_sessions')
        .select('is_active, expires_at, title')
        .eq('id', qrSessionId)
        .single()

      if (sessionError || !sessionData) {
        console.error('Error validating QR session:', sessionError)
        alert('Error: No se pudo validar la sesión QR.')
        return
      }

      if (!sessionData.is_active) {
        alert('Esta sesión QR ha sido desactivada y ya no acepta nuevos resultados.')
        return
      }

      if (sessionData.expires_at && new Date(sessionData.expires_at) < new Date()) {
        alert('Esta sesión QR ha expirado y ya no acepta nuevos resultados.')
        return
      }

      // Nota: Ya no verificamos si el jugador participó previamente
      // porque usamos UPSERT que actualiza automáticamente si ya existe

      const results = calculateResults()
      const avgTime = answers.length > 0
        ? answers.reduce((sum, a) => sum + a.timeToAnswer, 0) / answers.length / 1000
        : 0

      const gameData = {
        game_title: selectedGame.title,
        answers: answers,
        completed_at: new Date().toISOString()
      }

      console.log('Saving QR results:', {
        qrSessionId,
        playerName: name.trim(),
        totalPoints: results.totalPoints,
        totalCorrect: results.correctAnswers,
        totalQuestions: results.totalQuestions,
        avgTime,
        gameData
      })

      const { error } = await qrResultsHelpers.saveQRSessionResult(
        qrSessionId,
        normalizedName,
        results.totalPoints,
        results.correctAnswers,
        results.totalQuestions,
        avgTime,
        gameData
      )

      if (error) {
        console.error('Error saving QR results:', error)

        // Verificar si es un error de tabla no encontrada
        if (error.code === '42P01') {
          alert('Error: La tabla de resultados no existe. Por favor ejecuta la migración de base de datos antes de jugar.')
        } else if (error.code === '23505' || error.message?.includes('unique_player_per_session')) {
          // Error de clave duplicada - el jugador ya participó
          alert(`Ya existe un resultado guardado para "${normalizedName}" en esta sesión. Tu nuevo resultado ha sido actualizado.`)
        } else {
          alert(`Error al guardar resultados: ${error.message}. Puedes continuar viendo tus puntos.`)
        }
      } else {
        console.log('QR results saved successfully!')
      }
    } catch (err) {
      console.error('Unexpected error saving QR results:', err)
      alert('Error inesperado al guardar resultados. Puedes continuar viendo tus puntos.')
    } finally {
      setSavingResults(false)
    }
  }, [isQRSession, qrSessionId, selectedGame, answers, calculateResults, qrResultsSaved])

  // Manejar guardado automático para sesión QR
  const handleAutoSaveQRResults = useCallback(async () => {
    if (isQRSession && qrSessionId && playerName.trim()) {
      await saveQRResults(playerName)
    }
  }, [isQRSession, qrSessionId, playerName, saveQRResults])

  // Si es sesión QR y tenemos juego, ir directo a selección
  useEffect(() => {
    if (isQRSession && selectedGame) {
      setGameState('select')
    } else if (!isQRSession) {
      loadGames()
    }
  }, [isQRSession, selectedGame])

  // Auto-guardar resultados cuando el juego termine en sesiones QR
  useEffect(() => {
    if (gameState === 'results' && isQRSession && qrSessionId && playerName.trim() && !qrResultsSaved) {
      handleAutoSaveQRResults()
    }
  }, [gameState, qrResultsSaved]) // Simplificado: solo depende de gameState y la bandera

  // Inicializar audio con primera interacción del usuario
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!isAudioEnabled) {
        initializeAudio()
      }
      // Remover listeners después de la primera interacción
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
    }

    // Agregar listeners para diferentes tipos de interacción
    document.addEventListener('click', handleFirstInteraction)
    document.addEventListener('keydown', handleFirstInteraction)
    document.addEventListener('touchstart', handleFirstInteraction)

    return () => {
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
    }
  }, [initializeAudio, isAudioEnabled])

  const questionOpen = gameState === 'playing' && !showIntro && !showAnswer

  // Cuenta atrás de la pregunta
  useEffect(() => {
    if (!questionOpen) return

    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(interval)
  }, [questionOpen, currentQuestionIndex])

  // Avisos del reloj y cierre de la pregunta al llegar a cero
  useEffect(() => {
    if (!questionOpen) return

    if (timeLeft === 0) {
      handleTimeUp()
      return
    }

    if (timeLeft === 10) {
      // Un solo tick a los 10 segundos
      playTick()
    } else if (timeLeft <= 5) {
      // Tick en los últimos 5 segundos
      playTick(timeLeft <= 3)
      // Añadir vibración en dispositivos móviles si está disponible
      if ('vibrate' in navigator && timeLeft <= 3) {
        navigator.vibrate(100)
      }
    }
  }, [timeLeft, questionOpen])

  // Música mientras se juega. Si la pregunta trae su propio sonido, la música
  // calla mientras está abierta para que se oiga.
  const currentQuestion = shuffledQuestions[currentQuestionIndex]
  const questionAudioOpen = questionOpen && !!currentQuestion?.audio_url
  useEffect(() => {
    if (gameState === 'playing' && !questionAudioOpen) startMusic('countdown')
    else stopMusic()
  }, [gameState, questionAudioOpen, startMusic, stopMusic])

  // La imagen se descarga durante la cuenta atrás para que ya esté al abrirse la pregunta
  const questionImage = gameState === 'playing' ? currentQuestion?.image_url : null
  useEffect(() => {
    preloadQuestionImage(questionImage)
  }, [questionImage])

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

  // Mostrar una pregunta: primero solo el enunciado y, tras una pausa, las respuestas y el reloj
  const beginQuestion = (index: number, questions: ShuffledQuestion[]) => {
    setCurrentQuestionIndex(index)
    setSelectedAnswer(null)
    setShowAnswer(false)
    setShowIntro(true)
    setTimeLeft(questions[index].time_limit)

    later(() => {
      setShowIntro(false)
      setQuestionStartTime(Date.now())
    }, INTRO_MS)
  }

  // Mezclar preguntas y opciones y empezar una partida
  const startGame = (game: Game) => {
    if (!game.questions?.length) return

    // Primero mezclar el orden de las preguntas y luego las opciones de cada una
    const shuffled = shuffleArray(game.questions).map(question => shuffleQuestionOptions(question))
    setShuffledQuestions(shuffled)
    setAnswers([])
    setGameStartTime(Date.now())
    setQrResultsSaved(false) // Resetear bandera al iniciar un nuevo juego
    setGameState('playing')

    // Reproducir sonido de inicio de juego
    playGameStart()

    beginQuestion(0, shuffled)
  }

  const handleGameSelect = (game: Game) => {
    setSelectedGame(game)
    startGame(game)
  }

  const handleAnswerSelect = (answerIndex: number) => {
    if (!questionOpen || selectedAnswer !== null) return

    const currentShuffledQuestion = shuffledQuestions[currentQuestionIndex]
    if (!currentShuffledQuestion) return

    const timeToAnswer = Date.now() - questionStartTime
    const isCorrect = answerIndex === currentShuffledQuestion.correctAnswerIndex
    const pointsEarned = calculatePoints(isCorrect, timeToAnswer, currentShuffledQuestion.time_limit)

    setSelectedAnswer(answerIndex)
    setShowAnswer(true)

    // Reproducir sonido según si la respuesta es correcta o incorrecta
    if (isCorrect) {
      playCorrect()
    } else {
      playIncorrect()
    }

    // Guardar respuesta
    setAnswers(prev => [...prev, {
      questionIndex: currentQuestionIndex,
      selectedAnswer: answerIndex,
      isCorrect,
      timeToAnswer,
      pointsEarned
    }])

    // Avanzar automáticamente a la siguiente pregunta
    later(handleNextQuestion, REVEAL_MS)
  }

  const handleTimeUp = () => {
    if (showAnswer || selectedAnswer !== null) return

    const timeToAnswer = Date.now() - questionStartTime

    // Reproducir sonido de tiempo agotado
    playTimeUp()

    // Respuesta por tiempo agotado
    setAnswers(prev => [...prev, {
      questionIndex: currentQuestionIndex,
      selectedAnswer: -1, // -1 indica sin respuesta
      isCorrect: false,
      timeToAnswer,
      pointsEarned: 0
    }])

    setShowAnswer(true)

    // Avanzar automáticamente a la siguiente pregunta
    later(handleNextQuestion, REVEAL_MS)
  }

  const handleNextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1

    if (!shuffledQuestions || nextIndex >= shuffledQuestions.length) {
      // Juego terminado - reproducir sonido de fin de juego
      playGameEnd()

      setGameState('results')
      return
    }

    beginQuestion(nextIndex, shuffledQuestions)
  }

  const handlePlayAgain = () => {
    if (selectedGame) {
      startGame(selectedGame)
    }
  }

  const handleSelectNewGame = () => {
    setSelectedGame(null)
    setGameState('select')
  }

  // Manejar mostrar leaderboard
  const handleShowLeaderboard = () => {
    setGameState('leaderboard')
  }

  // Manejar volver desde leaderboard
  const handleBackFromLeaderboard = () => {
    setGameState('results')
  }

  // Cabecera común: azul con la franja de la bandera
  const renderHeader = (title: string, subtitle?: string) => (
    <header className="bg-dominican-blue text-white shadow-md">
      <div className="flex items-center justify-between gap-3 px-4 py-3 max-w-4xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-bold text-white/85 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          Salir
        </button>
        <div className="text-center min-w-0">
          <p className="font-display text-lg leading-tight truncate">{title}</p>
          {subtitle && <p className="text-xs font-semibold text-white/80">{subtitle}</p>}
        </div>
        <button
          onClick={toggleMute}
          className="p-1.5 rounded-full bg-white/15 hover:bg-white/25"
          title={isMuted ? 'Activar sonido' : 'Silenciar'}
          aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
      {/* franja de la bandera */}
      <div className="h-1 bg-white" />
      <div className="h-1.5 bg-dominican-red" />
    </header>
  )

  // Mostrar selector de juegos
  if (gameState === 'select' && !isQRSession) {
    return (
      <GameSelector
        games={games}
        onSelectGame={handleGameSelect}
        onBack={onBack}
        title="Selecciona un Juego Individual"
      />
    )
  }

  // Pantalla de confirmación para sesiones QR
  if (gameState === 'select' && isQRSession && selectedGame) {
    return (
      <div className="min-h-screen flex flex-col fondo-caribe text-dominican-blue-dark">
        {renderHeader(qrSessionTitle || 'Juego Individual')}

        <main className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-4 py-6">
          <div className="w-full bg-white rounded-2xl shadow-xl border-t-8 border-dominican-red p-6 sm:p-8 text-center">
            <h2 className="font-display text-3xl sm:text-4xl text-dominican-blue mb-2">
              {selectedGame.title}
            </h2>

            {selectedGame.description && (
              <p className="text-gray-600 font-semibold mb-6">
                {selectedGame.description}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 my-6">
              <div className="bg-arena p-4 rounded-2xl">
                <div className="font-display text-4xl text-dominican-red">
                  {selectedGame.questions?.length || 0}
                </div>
                <p className="text-gray-600 font-bold text-sm">Preguntas</p>
              </div>

              <div className="bg-arena p-4 rounded-2xl">
                <div className="font-display text-4xl text-dominican-red">
                  ~{Math.ceil((selectedGame.questions?.reduce((acc, q) => acc + q.time_limit, 0) || 0) / 60)}
                </div>
                <p className="text-gray-600 font-bold text-sm">Minutos</p>
              </div>
            </div>

            <button
              onClick={() => startGame(selectedGame)}
              className="w-full flex items-center justify-center gap-2 bg-dominican-red hover:bg-dominican-red-light text-white font-display text-2xl py-4 rounded-2xl shadow-[0_6px_0_#A50E1E] transition-all active:translate-y-1 active:shadow-[0_2px_0_#A50E1E]"
            >
              <Play className="w-6 h-6" />
              ¡Arrancar!
            </button>
          </div>
        </main>
      </div>
    )
  }

  // Pantalla de juego
  if (gameState === 'playing' && selectedGame?.questions && shuffledQuestions.length > 0) {
    const currentShuffledQuestion = shuffledQuestions[currentQuestionIndex]
    const totalPoints = answers.reduce((total, answer) => total + answer.pointsEarned, 0)
    const lastAnswer = answers[answers.length - 1]
    const answeredCorrectly = selectedAnswer === currentShuffledQuestion.correctAnswerIndex

    return (
      <div className="min-h-screen flex flex-col fondo-caribe text-dominican-blue-dark">
        {renderHeader(
          selectedGame.title,
          `Pregunta ${currentQuestionIndex + 1} de ${shuffledQuestions.length} · ${totalPoints} puntos`
        )}

        <main className="flex-1 flex flex-col w-full max-w-4xl mx-auto px-4 pt-4 pb-6">
          {showIntro ? (
            // Primero solo la pregunta
            <div className="flex-1 flex flex-col items-center justify-center gap-7 text-center">
              <span className="bg-dominican-blue text-white rounded-full px-5 py-2 font-display text-lg">
                Pregunta {currentQuestionIndex + 1} de {shuffledQuestions.length}
              </span>
              <h2
                key={currentQuestionIndex}
                className="bg-white text-dominican-blue-dark rounded-2xl shadow-xl border-t-8 border-dominican-red px-6 py-8 text-2xl sm:text-4xl font-black w-full animate-pop-in"
              >
                {currentShuffledQuestion.text}
              </h2>
              <div className="w-full max-w-xl h-3 bg-dominican-blue/15 rounded-full overflow-hidden">
                <div
                  key={currentQuestionIndex}
                  className="h-full bg-dominican-red rounded-full animate-vaciar-barra"
                  style={{ animationDuration: `${INTRO_MS}ms` }}
                />
              </div>
              <p className="font-display text-2xl text-dominican-red">¡Ponte pila!</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-4">
              {showAnswer ? (
                <div
                  className={`rounded-2xl px-5 py-4 text-center text-white shadow-xl animate-pop-in ${
                    selectedAnswer === null ? 'bg-slate-600' : answeredCorrectly ? 'bg-palma' : 'bg-dominican-red'
                  }`}
                >
                  <p className="font-display text-3xl sm:text-4xl">
                    {selectedAnswer === null ? '¡Se te fue la guagua!' : answeredCorrectly ? '¡La botaste!' : '¡Te ponchaste!'}
                  </p>
                  <p className="font-bold text-white/95">
                    {selectedAnswer === null
                      ? 'No respondiste a tiempo'
                      : answeredCorrectly
                        ? `Correcto · +${lastAnswer?.pointsEarned ?? 0} puntos`
                        : 'Incorrecto · 0 puntos'}
                  </p>
                  <p className="text-sm font-semibold text-white/85">
                    {currentQuestionIndex + 1 < shuffledQuestions.length
                      ? 'Viene la siguiente pregunta…'
                      : 'Calculando resultados…'}
                  </p>
                </div>
              ) : (
                <h2 className="bg-white text-dominican-blue-dark rounded-2xl shadow-lg border-t-8 border-dominican-red px-5 py-5 text-xl sm:text-3xl font-black text-center">
                  {currentShuffledQuestion.text}
                </h2>
              )}

              {!showAnswer && (
                <QuestionMedia
                  key={currentShuffledQuestion.id}
                  imageUrl={currentShuffledQuestion.image_url}
                  audioUrl={currentShuffledQuestion.audio_url}
                  autoPlay
                  muted={isMuted}
                />
              )}

              {showAnswer && (
                <h2 className="text-center text-lg sm:text-2xl font-black">{currentShuffledQuestion.text}</h2>
              )}

              <div className="flex items-center gap-3">
                <div
                  className={`w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg ${
                    timeLeft <= 5 && !showAnswer ? 'bg-dominican-red animate-pulse' : 'bg-dominican-blue'
                  }`}
                >
                  <span className="font-display text-3xl sm:text-4xl leading-none tabular-nums">{timeLeft}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide">seg</span>
                </div>
                <div className="flex-1 h-2.5 bg-dominican-blue/15 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
                      timeLeft <= 5 ? 'bg-dominican-red' : 'bg-dominican-blue'
                    }`}
                    style={{ width: `${(timeLeft / currentShuffledQuestion.time_limit) * 100}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 auto-rows-fr gap-3 flex-1 max-h-[30rem] mt-auto">
                {currentShuffledQuestion.shuffledOptions.slice(0, 4).map((option, index) => {
                  const isSelected = selectedAnswer === index
                  return (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(index)}
                      disabled={showAnswer}
                      className={`${ANSWER_STYLES[index].bg} tablita relative flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 sm:gap-4 rounded-2xl border-4 border-white px-3 sm:px-5 py-4 min-h-[6rem] text-center sm:text-left text-white text-base sm:text-2xl font-bold shadow-lg transition-all active:scale-95 ${
                        !showAnswer
                          ? 'hover:brightness-110 hover:-translate-y-0.5'
                          : isSelected
                            ? 'ring-4 ring-dominican-blue'
                            : 'opacity-60 saturate-50'
                      }`}
                    >
                      <AnswerBadge icon={ANSWER_STYLES[index].icon} color={ANSWER_STYLES[index].text} className="w-12 h-12 sm:w-14 sm:h-14" />
                      <span className="break-words">{option}</span>
                      {/* Solo se marca la respuesta elegida: la correcta no se revela */}
                      {showAnswer && isSelected && (
                        <span className={`absolute top-2 right-2 rounded-full p-1 bg-white ${answeredCorrectly ? 'text-palma' : 'text-dominican-red'}`}>
                          {answeredCorrectly
                            ? <Check className="w-5 h-5" strokeWidth={4} />
                            : <X className="w-5 h-5" strokeWidth={4} />}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    )
  }


  // Vista de Leaderboard para sesión QR
  if (gameState === 'leaderboard' && isQRSession && qrSessionId) {
    return (
      <QRLeaderboard
        qrSessionId={qrSessionId}
        sessionTitle={qrSessionTitle || 'Sesión QR'}
        currentPlayerName={playerName}
        onBack={handleBackFromLeaderboard}
        // No pasamos onPlayAgain para que no aparezca el botón en modo QR
      />
    )
  }

  // Pantalla de resultados
  if (gameState === 'results' && selectedGame) {
    const results = calculateResults()
    const verdict =
      results.accuracy >= 80 ? { title: '¡Tú sí sabes!', color: 'bg-palma' }
      : results.accuracy >= 60 ? { title: '¡Vas bien!', color: 'bg-ambar' }
      : { title: '¡A practicar!', color: 'bg-dominican-red' }

    return (
      <div className="min-h-screen flex flex-col fondo-caribe text-dominican-blue-dark">
        {renderHeader('Resultados', selectedGame.title)}

        <main className="flex-1 w-full max-w-4xl mx-auto px-4 pt-4 pb-6 space-y-4">
          <div className={`${verdict.color} rounded-2xl px-5 py-5 text-center text-white shadow-xl animate-pop-in`}>
            <p className="font-display text-4xl sm:text-5xl">{verdict.title}</p>
            <p className="font-bold text-white/95">
              Acertaste {results.correctAnswers} de {results.totalQuestions} preguntas
            </p>
          </div>

          {/* Estadísticas principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl shadow-lg p-4 text-center">
              <div className="font-display text-3xl text-dominican-red tabular-nums">{results.totalPoints}</div>
              <p className="text-gray-600 font-bold text-sm">Puntos</p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-4 text-center">
              <div className="font-display text-3xl text-palma tabular-nums">{results.accuracy}%</div>
              <p className="text-gray-600 font-bold text-sm">Precisión</p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-4 text-center">
              <div className="font-display text-3xl text-larimar tabular-nums">
                {results.correctAnswers}/{results.totalQuestions}
              </div>
              <p className="text-gray-600 font-bold text-sm">Correctas</p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-4 text-center">
              <div className="font-display text-3xl text-ambar tabular-nums">
                {Math.floor(results.timeSpent / 60)}:{(results.timeSpent % 60).toString().padStart(2, '0')}
              </div>
              <p className="text-gray-600 font-bold text-sm">Tiempo</p>
            </div>
          </div>

          {/* Revisión de respuestas */}
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <h3 className="font-display text-xl text-dominican-blue mb-3">Revisión de respuestas</h3>
            <div className="space-y-2">
              {answers.map((answer, index) => {
                const question = shuffledQuestions[answer.questionIndex]
                return (
                  <div key={index} className="flex items-center gap-3 p-3 bg-arena rounded-xl">
                    <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white ${
                      answer.isCorrect ? 'bg-palma' : 'bg-dominican-red'
                    }`}>
                      {answer.isCorrect ? <Check className="w-5 h-5" strokeWidth={3} /> : <X className="w-5 h-5" strokeWidth={3} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">
                        {question?.text}
                      </p>
                      <p className="text-xs text-gray-600">
                        {answer.selectedAnswer === -1
                          ? 'Sin respuesta (tiempo agotado)'
                          : `Tu respuesta: ${shuffledQuestions[answer.questionIndex]?.shuffledOptions[answer.selectedAnswer] || 'N/A'}`
                        }
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-display text-lg text-dominican-blue tabular-nums">
                        +{answer.pointsEarned}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(answer.timeToAnswer / 1000).toFixed(1)}s
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap gap-3">
            {!isQRSession && (
              <button
                onClick={handlePlayAgain}
                className="flex-1 min-w-[10rem] flex items-center justify-center gap-2 bg-dominican-red hover:bg-dominican-red-light text-white font-display text-xl px-6 py-3 rounded-2xl shadow-[0_5px_0_#A50E1E] transition-all active:translate-y-1 active:shadow-[0_1px_0_#A50E1E]"
              >
                <RotateCcw className="w-5 h-5" />
                Jugar de nuevo
              </button>
            )}

            {isQRSession && qrSessionId && (
              <button
                onClick={handleShowLeaderboard}
                className="flex-1 min-w-[10rem] flex items-center justify-center gap-2 bg-ambar hover:brightness-110 text-white font-display text-xl px-6 py-3 rounded-2xl shadow-[0_5px_0_#9A6200] transition-all active:translate-y-1 active:shadow-[0_1px_0_#9A6200]"
              >
                <Trophy className="w-5 h-5" />
                Tabla de posiciones
              </button>
            )}

            {!isQRSession && (
              <button
                onClick={handleSelectNewGame}
                className="flex-1 min-w-[10rem] bg-white text-dominican-blue font-display text-xl px-6 py-3 rounded-2xl shadow-[0_5px_0_#cbd5e1] transition-all active:translate-y-1 active:shadow-[0_1px_0_#cbd5e1]"
              >
                Elegir otro juego
              </button>
            )}

            <button
              onClick={onBack}
              className="flex-1 min-w-[10rem] bg-dominican-blue hover:bg-dominican-blue-light text-white font-display text-xl px-6 py-3 rounded-2xl shadow-[0_5px_0_#001A3A] transition-all active:translate-y-1 active:shadow-[0_1px_0_#001A3A]"
            >
              Salir
            </button>
          </div>
        </main>
      </div>
    )
  }

  // Loading state
  return (
    <div className="min-h-screen fondo-caribe flex items-center justify-center">
      <div className="text-center">
        <div className="loading-spinner mx-auto mb-4"></div>
        <p className="font-bold text-dominican-blue">Cargando juego...</p>
      </div>
    </div>
  )
}

export default SinglePlayerGame
