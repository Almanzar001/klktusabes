import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, Copy, Crown, Play, Presentation, SkipForward, Trophy, Users, Volume2, VolumeX, X } from 'lucide-react'
import { roomHelpers, realtimeHelpers, sessionHelpers } from '../insforge'
import { Room, Player, Game, answersAreImagesOnly, shuffledOrder } from '../types'
import { useGameSounds } from '../hooks/useGameSounds'
import { useSpeech, SpeechSegment } from '../hooks/useSpeech'
import PlayerAvatar from './PlayerAvatar'
import AnswerBadge, { ANSWER_STYLES } from './AnswerBadge'
import AnswerTile, { AnswerThumbnail, answerGridClass } from './AnswerTile'
import QuestionMedia, { preloadQuestionImages } from './QuestionMedia'
import SpeakButton from './SpeakButton'

interface MultiplayerRoomProps {
  room: Room
  // null cuando quien creó la sala solo dirige la partida (por ejemplo, un profesor)
  player: Player | null
  onBack: () => void
}

// La fase sale de la fila de rooms: todos los dispositivos pintan lo mismo
type Phase = 'lobby' | 'intro' | 'question' | 'reveal' | 'podium'

interface AnswerRow {
  player_id: string
  answer: number
  is_correct?: boolean
  points_earned?: number
}

const STATUS_STEP: Record<Room['status'], number> = {
  waiting: 0,
  playing: 1,
  show_results: 2,
  finished: 3
}

// Avance de la partida como número creciente, para no retroceder si llega un estado viejo
const progressOf = (room: Pick<Room, 'status' | 'current_question_index'>) => {
  if (room.status === 'waiting') return 0
  if (room.status === 'finished') return Number.MAX_SAFE_INTEGER
  return (room.current_question_index ?? 0) * 10 + STATUS_STEP[room.status]
}

const Scoreboard: React.FC<{ ranked: Player[]; meId: string | null; limit: number }> = ({ ranked, meId, limit }) => {
  const myPosition = ranked.findIndex(p => p.id === meId)
  const visible = ranked.slice(0, limit)

  const row = (p: Player, position: number) => (
    <li
      key={p.id}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
        p.id === meId ? 'bg-dominican-blue text-white' : 'bg-arena'
      }`}
    >
      <span className="w-6 text-center font-display text-lg tabular-nums">{position + 1}</span>
      <PlayerAvatar avatar={p.avatar} size="sm" />
      <span className="flex-1 font-bold truncate">{p.name}</span>
      <span className="font-display text-lg tabular-nums">{p.score ?? 0}</span>
    </li>
  )

  return (
    <div className="bg-white rounded-2xl shadow-lg p-3">
      <p className="flex items-center gap-2 font-display text-lg text-dominican-blue mb-2">
        <Trophy className="w-5 h-5 text-ambar" />
        Tabla de posiciones
      </p>
      <ol className="space-y-1.5">
        {visible.map((p, index) => row(p, index))}
        {myPosition >= limit && row(ranked[myPosition], myPosition)}
      </ol>
    </div>
  )
}

const MultiplayerRoom: React.FC<MultiplayerRoomProps> = ({ room: initialRoom, player, onBack }) => {
  const {
    playCorrect,
    playIncorrect,
    playTick,
    playTimeUp,
    playGameStart,
    playGameEnd,
    playAnswerSent,
    playPlayerJoined,
    startMusic,
    stopMusic,
    toggleMute,
    isMuted,
    initializeAudio,
    isAudioEnabled
  } = useGameSounds({ playsAloud: !player || player.is_host })
  const { canSpeak, speaking, currentId: spokenId, speak, stop: stopSpeaking } = useSpeech()

  const roomId = initialRoom.id
  // Sin jugador propio se está dirigiendo la partida: se controla el ritmo pero no se responde
  const isHost = player ? player.is_host : true
  const playerId = player?.id ?? null
  const minPlayers = player ? 2 : 1

  // Estado que viene de la base de datos
  const [room, setRoom] = useState<Room>(initialRoom)
  const [players, setPlayers] = useState<Player[]>([])
  const [game, setGame] = useState<Game | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<AnswerRow[]>([]) // respuestas a la pregunta actual

  // Estado local
  const [serverOffset, setServerOffset] = useState(0) // reloj del servidor menos el de este dispositivo
  const [now, setNow] = useState(() => Date.now())
  const [myAnswer, setMyAnswer] = useState<{ questionId: string; answer: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)

  const questions = game?.questions ?? []
  const questionIndex = room.current_question_index ?? 0
  const question = questions[questionIndex]
  const questionId = question?.id
  const startAt = room.question_started_at ? new Date(room.question_started_at).getTime() : 0
  const limitMs = (question?.time_limit || 30) * 1000
  const serverNow = now + serverOffset

  const phase: Phase =
    room.status === 'waiting' ? 'lobby'
    : room.status === 'finished' ? 'podium'
    : room.status === 'show_results' ? 'reveal'
    : serverNow < startAt ? 'intro'
    : 'question'

  const timeLeft = Math.max(0, Math.ceil((startAt + limitMs - serverNow) / 1000))
  const mySavedAnswer = playerId ? answers.find(a => a.player_id === playerId) : undefined
  const selectedAnswer = myAnswer && myAnswer.questionId === questionId ? myAnswer.answer : mySavedAnswer?.answer ?? null

  // Orden en que se muestran las respuestas en este dispositivo: distinto para
  // cada jugador y en cada partida, y fijo mientras dura la pregunta. El color y
  // el símbolo van con la posición; al servidor se envía el índice original.
  // En las trivias que se leen en voz alta el orden es el mismo para todos: así
  // la voz y el resaltado de la pantalla grande les sirven a quienes aún no leen.
  const readAloud = !!game?.read_aloud && canSpeak
  const optionCount = Math.min(question?.options.length ?? 0, 4)
  const answerOrder = useMemo(
    () => shuffledOrder(optionCount, readAloud ? `${sessionId}:${questionId}` : `${sessionId}:${playerId ?? 'director'}:${questionId}`),
    [optionCount, sessionId, playerId, questionId, readAloud]
  )

  // --- Lectura en voz alta ---
  const questionSpeech = (): SpeechSegment[] => (question ? [{ text: question.text, id: 'pregunta' }] : [])
  const answersSpeech = (): SpeechSegment[] =>
    answerOrder.map(optionIndex => ({ text: question?.options[optionIndex] ?? '', id: optionIndex }))

  // El dispositivo que lleva el sonido de la partida lee solo: la pregunta durante
  // la cuenta atrás y las respuestas al abrirse. Los demás tienen el botón.
  const readsAlone = readAloud && isHost
  const introReadFor = useRef<string | null>(null)
  const [readQuestionId, setReadQuestionId] = useState<string | null>(null) // pregunta que ya se terminó de leer
  useEffect(() => {
    if (!readsAlone || !questionId || isMuted) return

    if (phase === 'intro') {
      introReadFor.current = questionId
      speak(questionSpeech())
    } else if (phase === 'question') {
      speak(introReadFor.current === questionId ? answersSpeech() : [...questionSpeech(), ...answersSpeech()], {
        append: true,
        onDone: () => setReadQuestionId(questionId)
      })
    } else {
      stopSpeaking()
    }
  }, [phase, questionId, readsAlone])

  useEffect(() => {
    if (isMuted) stopSpeaking()
  }, [isMuted, stopSpeaking])

  // El sonido de la pregunta espera a que termine la voz
  const audioWaits = readsAlone && !isMuted && readQuestionId !== questionId

  const handleSpeak = () => {
    if (speaking) stopSpeaking()
    else speak([...questionSpeech(), ...answersSpeech()])
  }

  const ranked = useMemo(
    () => [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.joined_at.localeCompare(b.joined_at)),
    [players]
  )
  const myPosition = ranked.findIndex(p => p.id === playerId)
  const myScore = ranked[myPosition]?.score ?? 0

  // --- Carga de datos ---

  const applyRoom = useCallback((incoming: Partial<Room> | null | undefined) => {
    if (!incoming) return
    setRoom(prev => {
      const next = { ...prev, ...incoming }
      return progressOf(next) >= progressOf(prev) ? next : prev
    })
  }, [])

  const loadRoom = useCallback(async () => {
    const { data } = await roomHelpers.getRoom(roomId)
    applyRoom(data)
  }, [roomId, applyRoom])

  const loadPlayers = useCallback(async () => {
    const { data } = await roomHelpers.getRoomPlayers(roomId)
    if (data) setPlayers(data)
  }, [roomId])

  const loadGame = useCallback(async () => {
    const { data } = await roomHelpers.getRoomGame(roomId)
    if (data) {
      setSessionId(data.sessionId)
      setGame(data.game)
    }
  }, [roomId])

  const currentQuestionId = useRef<string | undefined>(questionId)

  const loadAnswers = useCallback(async () => {
    if (!sessionId || !questionId) return
    const { data } = await sessionHelpers.getQuestionAnswers(sessionId, questionId)
    // puede haber cambiado la pregunta mientras llegaba la respuesta
    if (data && currentQuestionId.current === questionId) setAnswers(data)
  }, [sessionId, questionId])

  useEffect(() => {
    loadRoom()
    loadPlayers()
    loadGame()
    sessionHelpers.getServerTimeOffset().then(setServerOffset)
  }, [loadRoom, loadPlayers, loadGame])

  // --- Tiempo real ---

  useEffect(() => {
    const subscriptions = [
      realtimeHelpers.subscribeToRoom(roomId, (payload) => applyRoom(payload.new)),
      realtimeHelpers.subscribeToRoomPlayers(roomId, () => loadPlayers()),
      realtimeHelpers.subscribeToGameSession(roomId, () => loadGame()),
      // lo ocurrido durante un corte de conexión no se reenvía: se vuelve a leer
      realtimeHelpers.onReconnect(() => {
        loadRoom()
        loadPlayers()
        loadGame()
      })
    ]

    return () => {
      subscriptions.forEach(realtimeHelpers.unsubscribe)
    }
  }, [roomId, applyRoom, loadRoom, loadPlayers, loadGame])

  useEffect(() => {
    if (!sessionId) return

    const subscription = realtimeHelpers.subscribeToSessionAnswers(sessionId, (payload) => {
      const row = payload.new
      if (payload.eventType !== 'INSERT' || !row || row.question_id !== currentQuestionId.current) return
      setAnswers(prev => (prev.some(a => a.player_id === row.player_id) ? prev : [...prev, row]))
    })

    return () => {
      realtimeHelpers.unsubscribe(subscription)
    }
  }, [sessionId])

  // Red de seguridad por si se pierde un evento: releer la fase cada pocos segundos
  useEffect(() => {
    if (room.status === 'finished') return
    const interval = setInterval(loadRoom, 4000)
    return () => clearInterval(interval)
  }, [room.status, loadRoom])

  // Al cambiar de pregunta se empieza con las respuestas en blanco
  useEffect(() => {
    currentQuestionId.current = questionId
    setAnswers([])
    setMyAnswer(prev => (prev && prev.questionId === questionId ? prev : null))
    loadAnswers()
  }, [questionId, loadAnswers])

  // Al mostrar resultados se leen las respuestas y puntos definitivos
  useEffect(() => {
    if (room.status === 'show_results' || room.status === 'finished') {
      loadAnswers()
      loadPlayers()
    }
  }, [room.status, questionIndex, loadAnswers, loadPlayers])

  // Reloj local mientras hay una pregunta abierta
  useEffect(() => {
    if (room.status !== 'playing') return
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(interval)
  }, [room.status, questionIndex])

  // --- Cierre de la pregunta ---

  const revealRequestedFor = useRef<number | null>(null)

  const requestReveal = useCallback(async () => {
    if (revealRequestedFor.current === questionIndex) return
    revealRequestedFor.current = questionIndex
    const { data, error } = await roomHelpers.revealAnswer(roomId, questionIndex)
    if (error) {
      revealRequestedFor.current = null
      return
    }
    applyRoom(data)
  }, [roomId, questionIndex, applyRoom])

  useEffect(() => {
    if (phase !== 'question' || !question) return

    const everyoneAnswered = players.length > 0 && answers.length >= players.length
    // El anfitrión cierra la pregunta; los demás lo hacen poco después por si su
    // dispositivo está en segundo plano o sin conexión
    const graceMs = isHost ? 300 : 2500
    const timeIsUp = serverNow >= startAt + limitMs + graceMs

    if ((isHost && everyoneAnswered) || timeIsUp) {
      requestReveal()
    }
  }, [phase, question, players.length, answers.length, serverNow, startAt, limitMs, isHost, requestReveal])

  // --- Sonidos ---

  // Inicializar audio con primera interacción del usuario
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!isAudioEnabled) {
        initializeAudio()
      }
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
    }

    document.addEventListener('click', handleFirstInteraction)
    document.addEventListener('keydown', handleFirstInteraction)
    document.addEventListener('touchstart', handleFirstInteraction)

    return () => {
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
    }
  }, [initializeAudio, isAudioEnabled])

  const previousPhase = useRef<Phase>(phase)

  useEffect(() => {
    const before = previousPhase.current
    previousPhase.current = phase
    if (before === phase) return

    if (phase === 'intro' && questionIndex === 0) playGameStart()
    if (phase === 'reveal') {
      if (!mySavedAnswer) playTimeUp()
      else if (mySavedAnswer.is_correct) playCorrect()
      else playIncorrect()
    }
    if (phase === 'podium') playGameEnd()
  }, [phase])

  useEffect(() => {
    if (phase === 'question' && selectedAnswer === null && timeLeft > 0 && timeLeft <= 5) {
      playTick(timeLeft <= 3)
    }
  }, [timeLeft])

  // La música suena solo en el dispositivo del anfitrión, para que no se pisen
  // varios dispositivos cuando todos juegan en el mismo lugar. Si la pregunta
  // trae su propio sonido, la música calla para que se oiga.
  const questionAudio = question?.audio_url
  useEffect(() => {
    if (!isHost) return
    if (phase === 'lobby') startMusic('lobby')
    else if (phase === 'question' && !questionAudio) startMusic('countdown')
    else stopMusic()
  }, [phase, isHost, questionAudio, startMusic, stopMusic])

  // Las imágenes se descargan durante la cuenta atrás, para que nadie pierda
  // segundos de respuesta esperando a que carguen
  useEffect(() => {
    preloadQuestionImages(question)
  }, [questionId])

  useEffect(() => stopMusic, [stopMusic])

  // Aviso sonoro cuando entra alguien a la sala de espera
  const knownPlayerCount = useRef(0)

  useEffect(() => {
    if (phase === 'lobby' && knownPlayerCount.current > 0 && players.length > knownPlayerCount.current) {
      playPlayerJoined()
    }
    knownPlayerCount.current = players.length
  }, [players.length])

  // --- Acciones ---

  const handleStart = async () => {
    setBusy(true)
    setError(null)
    const { data, error } = await roomHelpers.startGame(roomId)
    if (error) setError('No se pudo iniciar el juego')
    else applyRoom(data)
    setBusy(false)
  }

  const handleAnswer = async (answerIndex: number) => {
    if (!player || phase !== 'question' || selectedAnswer !== null || !sessionId || !question) return

    setError(null)
    setMyAnswer({ questionId: question.id, answer: answerIndex })
    playAnswerSent()

    const { data, error } = await sessionHelpers.submitAnswer(sessionId, player.id, question.id, answerIndex)

    if (error) {
      if (error.code === '23505') return // ya había una respuesta guardada
      setMyAnswer(null)
      setError(error.message || 'No se pudo enviar tu respuesta')
      return
    }

    setAnswers(prev => [...prev.filter(a => a.player_id !== player.id), data])
  }

  const handleNext = async () => {
    setBusy(true)
    setError(null)
    const isLastQuestion = questionIndex >= questions.length - 1
    const { data, error } = isLastQuestion
      ? await roomHelpers.finishGame(roomId)
      : await roomHelpers.goToNextQuestion(roomId, questionIndex)
    if (error) setError('No se pudo avanzar')
    else applyRoom(data)
    setBusy(false)
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch (err) {
      console.error('Error copying to clipboard:', err)
    }
  }

  // --- Vistas ---

  const renderLobby = () => (
    <div className="flex-1 flex flex-col items-center gap-6 pt-2">
      <button
        onClick={handleCopyCode}
        className="bg-white rounded-2xl shadow-xl overflow-hidden text-center transition-transform hover:scale-105"
        title="Copiar código"
      >
        <span className="flex h-2">
          <span className="flex-1 bg-dominican-blue" />
          <span className="flex-1 bg-white" />
          <span className="flex-1 bg-dominican-red" />
        </span>
        <span className="block px-8 pt-3 pb-4">
          <span className="flex items-center justify-center gap-2 text-sm font-bold text-gray-500 uppercase tracking-wide">
            Código de la sala
            <Copy className="w-4 h-4" />
          </span>
          <span className="block font-display text-6xl sm:text-8xl text-dominican-blue tracking-wider tabular-nums">
            {room.code.slice(0, 3)} {room.code.slice(3)}
          </span>
          <span className="block text-xs font-semibold text-gray-500">
            {codeCopied ? '¡Copiado!' : 'Entra en «Unirse a Sala» y escribe este código'}
          </span>
        </span>
      </button>

      {game && (
        <p className="text-center">
          <span className="font-display text-xl text-dominican-red">{game.title}</span>
          <span className="font-semibold text-gray-600"> · {questions.length} preguntas</span>
        </p>
      )}

      {!player && (
        <p className="flex items-center gap-2 bg-dominican-blue text-white rounded-full px-4 py-1.5 text-sm font-bold">
          <Presentation className="w-4 h-4" />
          Tú diriges la partida
        </p>
      )}

      <div className="w-full">
        <p className="flex items-center justify-center gap-2 font-bold text-dominican-blue mb-4">
          <Users className="w-5 h-5" />
          {players.length} {players.length === 1 ? 'jugador' : 'jugadores'} en la sala
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {players.map(p => (
            <div
              key={p.id}
              className={`flex items-center gap-2 rounded-full pl-1.5 pr-4 py-1.5 font-bold shadow animate-pop-in ${
                p.id === playerId ? 'bg-dominican-blue text-white' : 'bg-white'
              }`}
            >
              <PlayerAvatar avatar={p.avatar} size="sm" />
              <span className="max-w-[10rem] truncate">{p.name}</span>
              {p.is_host && <Crown className="w-4 h-4 text-ambar" />}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto w-full max-w-md text-center">
        {isHost ? (
          <>
            <button
              onClick={handleStart}
              disabled={busy || players.length < minPlayers || !game}
              className="w-full flex items-center justify-center gap-2 bg-dominican-red hover:bg-dominican-red-light text-white font-display text-2xl py-4 rounded-2xl shadow-[0_6px_0_#A50E1E] transition-all active:translate-y-1 active:shadow-[0_2px_0_#A50E1E] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-6 h-6" />
              {busy ? 'Arrancando…' : '¡Arrancar el juego!'}
            </button>
            {players.length < minPlayers && (
              <p className="text-gray-600 font-semibold text-sm mt-4">
                {player ? 'Necesitas al menos 2 jugadores para arrancar' : 'Espera a que entre al menos un jugador'}
              </p>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg px-5 py-4">
            <p className="font-display text-2xl text-dominican-blue">¡Ya estás dentro!</p>
            <p className="text-gray-600 font-semibold text-sm">Espera a que el anfitrión arranque el juego…</p>
          </div>
        )}
      </div>
    </div>
  )

  const renderIntro = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-7 text-center">
      <span className="bg-dominican-blue text-white rounded-full px-5 py-2 font-display text-lg">
        Pregunta {questionIndex + 1} de {questions.length}
      </span>
      <h2
        key={questionId}
        className="bg-white text-dominican-blue-dark rounded-2xl shadow-xl border-t-8 border-dominican-red px-6 py-8 text-2xl sm:text-4xl font-black w-full animate-pop-in"
      >
        {question?.text}
      </h2>
      <div className="w-full max-w-xl h-3 bg-dominican-blue/15 rounded-full overflow-hidden">
        <div
          className="h-full bg-dominican-red rounded-full transition-[width] duration-200 ease-linear"
          style={{ width: `${Math.max(0, Math.min(100, ((startAt - serverNow) / 4000) * 100))}%` }}
        />
      </div>
      <p className="font-display text-2xl text-dominican-red">¡Ponte pila!</p>
    </div>
  )

  const imageAnswers = !!question && answersAreImagesOnly(question.options, question.option_images)

  const renderQuestion = () => (
    <div className="flex-1 flex flex-col gap-4">
      <div className="relative">
        <h2 className={`bg-white text-dominican-blue-dark rounded-2xl shadow-lg border-t-8 border-dominican-red px-5 py-5 text-xl sm:text-3xl font-black text-center ${readAloud ? 'pr-14' : ''}`}>
          {question?.text}
        </h2>
        {readAloud && <SpeakButton speaking={speaking} onClick={handleSpeak} className="absolute -top-1 -right-2" />}
      </div>

      <QuestionMedia
        key={questionId}
        imageUrl={question?.image_url}
        audioUrl={question?.audio_url}
        autoPlay={!player || player.is_host}
        muted={isMuted}
        largeImage={imageAnswers}
        hold={audioWaits}
      />

      <div className="flex items-center justify-between gap-3">
        <div
          className={`w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg ${
            timeLeft <= 5 ? 'bg-dominican-red animate-pulse' : 'bg-dominican-blue'
          }`}
        >
          <span className="font-display text-3xl sm:text-4xl leading-none tabular-nums">{timeLeft}</span>
          <span className="text-[10px] font-bold uppercase tracking-wide">seg</span>
        </div>
        {selectedAnswer !== null && (
          <p className="font-display text-xl text-dominican-blue text-center animate-pop-in">
            ¡Respuesta enviada!
            <span className="block font-sans text-sm font-semibold text-gray-600">Aguanta, faltan los demás…</span>
          </p>
        )}
        {!player && (
          <button
            onClick={requestReveal}
            className="flex items-center gap-2 bg-white text-dominican-blue font-bold text-sm px-4 py-2 rounded-full shadow hover:bg-arena"
          >
            <SkipForward className="w-4 h-4" />
            Cerrar pregunta
          </button>
        )}
        <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl bg-white shadow-lg flex flex-col items-center justify-center text-dominican-blue">
          <span className="font-display text-3xl sm:text-4xl leading-none tabular-nums">{answers.length}</span>
          <span className="text-[10px] font-bold uppercase tracking-wide">resp.</span>
        </div>
      </div>

      <div className="h-2.5 bg-dominican-blue/15 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-linear ${
            timeLeft <= 5 ? 'bg-dominican-red' : 'bg-dominican-blue'
          }`}
          style={{ width: `${Math.max(0, Math.min(100, ((startAt + limitMs - serverNow) / limitMs) * 100))}%` }}
        />
      </div>

      <div className={answerGridClass(imageAnswers)}>
        {answerOrder.map((optionIndex, position) => (
          <AnswerTile
            key={optionIndex}
            position={position}
            text={question?.options[optionIndex] ?? ''}
            imageUrl={question?.option_images?.[optionIndex]?.url}
            onClick={() => handleAnswer(optionIndex)}
            disabled={!player || selectedAnswer !== null}
            speaking={spokenId === optionIndex}
            className={
              !player
                ? ''
                : selectedAnswer === null
                ? 'hover:brightness-110 hover:-translate-y-0.5 active:scale-95'
                : selectedAnswer === optionIndex
                  ? 'ring-4 ring-dominican-blue'
                  : 'opacity-60 saturate-50'
            }
          />
        ))}
      </div>
    </div>
  )

  const renderReveal = () => {
    const counts = [0, 1, 2, 3].map(index => answers.filter(a => a.answer === index).length)
    const maxCount = Math.max(1, ...counts)
    const isLastQuestion = questionIndex >= questions.length - 1
    const correctCount = question ? counts[question.correct_answer] ?? 0 : 0

    return (
      <div className="flex-1 flex flex-col gap-4">
        {!player ? (
          <div className="rounded-2xl px-5 py-4 text-center text-white shadow-xl animate-pop-in bg-dominican-blue">
            <p className="font-display text-3xl sm:text-4xl">
              {correctCount} de {players.length} {correctCount === 1 ? 'acertó' : 'acertaron'}
            </p>
            <p className="flex items-center justify-center gap-2 font-bold text-white/95">
              Respuesta correcta:
              <AnswerThumbnail imageUrl={question?.option_images?.[question.correct_answer]?.url} />
              {question?.options[question.correct_answer]}
            </p>
          </div>
        ) : (
        <div
          className={`rounded-2xl px-5 py-4 text-center text-white shadow-xl animate-pop-in ${
            !mySavedAnswer ? 'bg-slate-600' : mySavedAnswer.is_correct ? 'bg-palma' : 'bg-dominican-red'
          }`}
        >
          <p className="font-display text-3xl sm:text-4xl">
            {!mySavedAnswer ? '¡Se te fue la guagua!' : mySavedAnswer.is_correct ? '¡La botaste!' : '¡Te ponchaste!'}
          </p>
          <p className="font-bold text-white/95">
            {!mySavedAnswer
              ? 'No respondiste a tiempo'
              : mySavedAnswer.is_correct
                ? `Correcto · +${mySavedAnswer.points_earned ?? 0} puntos`
                : 'Incorrecto · 0 puntos'}
          </p>
          <p className="text-sm font-semibold text-white/85">
            Vas en el puesto {myPosition + 1} con {myScore} puntos
          </p>
        </div>
        )}

        <h2 className="text-center text-lg sm:text-2xl font-black text-dominican-blue-dark">{question?.text}</h2>

        <div className="grid grid-cols-4 gap-3 items-end h-32 px-2">
          {answerOrder.map((optionIndex, position) => (
            <div key={optionIndex} className="flex flex-col items-center justify-end h-full gap-1">
              <span className="flex items-center gap-1 font-display text-xl text-dominican-blue-dark tabular-nums">
                {counts[optionIndex]}
                {optionIndex === question?.correct_answer && <Check className="w-5 h-5 text-palma" strokeWidth={4} />}
              </span>
              <div
                className={`${ANSWER_STYLES[position].bg} tablita w-full rounded-t-xl transition-[height] duration-500 ${
                  optionIndex === question?.correct_answer ? '' : 'opacity-40'
                }`}
                style={{ height: `${Math.max(6, (counts[optionIndex] / maxCount) * 100)}%` }}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {answerOrder.map((optionIndex, position) => {
            const isCorrect = optionIndex === question?.correct_answer
            return (
              <div
                key={optionIndex}
                className={`flex items-center gap-2 sm:gap-3 rounded-xl border-4 px-2.5 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-xl font-bold shadow ${
                  isCorrect
                    ? `${ANSWER_STYLES[position].bg} tablita border-white text-white`
                    : 'bg-white border-white text-gray-500'
                } ${selectedAnswer === optionIndex ? 'ring-4 ring-dominican-blue' : ''}`}
              >
                <AnswerBadge icon={ANSWER_STYLES[position].icon} color={ANSWER_STYLES[position].text} className="w-7 h-7 sm:w-10 sm:h-10" />
                <AnswerThumbnail imageUrl={question?.option_images?.[optionIndex]?.url} />
                <span className="flex-1 break-words">{question?.options[optionIndex]}</span>
                {isCorrect
                  ? <Check className="w-6 h-6 shrink-0" strokeWidth={4} />
                  : <X className="w-6 h-6 shrink-0 text-gray-400" strokeWidth={4} />}
              </div>
            )
          })}
        </div>

        <Scoreboard ranked={ranked} meId={playerId} limit={5} />

        {isHost ? (
          <button
            onClick={handleNext}
            disabled={busy}
            className="sticky bottom-4 self-end flex items-center gap-2 bg-dominican-blue hover:bg-dominican-blue-light text-white font-display text-xl px-6 py-3 rounded-2xl shadow-[0_5px_0_#001A3A] transition-all active:translate-y-1 active:shadow-[0_1px_0_#001A3A] disabled:opacity-50"
          >
            {isLastQuestion ? 'Ver el podio' : 'Siguiente'}
            <ChevronRight className="w-6 h-6" />
          </button>
        ) : (
          <p className="text-center text-gray-600 font-semibold">Esperando al anfitrión…</p>
        )}
      </div>
    )
  }

  const renderPodium = () => {
    // orden visual: segundo, primero, tercero
    const steps = [
      { position: 1, height: 'h-28', color: 'bg-slate-300', avatarSize: 'lg' as const },
      { position: 0, height: 'h-40', color: 'bg-yellow-400', avatarSize: 'xl' as const },
      { position: 2, height: 'h-20', color: 'bg-amber-600', avatarSize: 'lg' as const }
    ]

    return (
      <div className="flex-1 flex flex-col items-center gap-6">
        <div className="text-center">
          <h2 className="flex items-center justify-center gap-3 font-display text-4xl sm:text-6xl text-dominican-blue">
            <Trophy className="w-9 h-9 sm:w-12 sm:h-12 text-ambar" />
            ¡Los duros!
          </h2>
          <p className="font-semibold text-gray-600">Los que más saben de esta partida</p>
        </div>

        <div className="flex items-end justify-center gap-2 sm:gap-5 w-full max-w-2xl">
          {steps.map(({ position, height, color, avatarSize }) => {
            const p = ranked[position]
            if (!p) return <div key={position} className="flex-1" />
            return (
              <div key={p.id} className="flex-1 flex flex-col items-center min-w-0 animate-pop-in">
                {position === 0 && <Crown className="w-8 h-8 text-ambar mb-1" />}
                <PlayerAvatar avatar={p.avatar} size={avatarSize} />
                <p className="font-bold text-dominican-blue-dark mt-2 max-w-full truncate">{p.name}</p>
                <p className="font-display text-lg text-dominican-red tabular-nums mb-2">{p.score ?? 0}</p>
                <div className={`${color} ${height} w-full rounded-t-2xl flex items-start justify-center pt-2 font-display text-5xl text-dominican-blue-dark shadow-lg`}>
                  {position + 1}
                </div>
              </div>
            )
          })}
        </div>

        {player && (
          <p className="bg-dominican-blue text-white rounded-full px-5 py-2 font-bold">
            Quedaste en el puesto {myPosition + 1} con {myScore} puntos
          </p>
        )}

        {ranked.length > 3 && (
          <div className="w-full max-w-md">
            <Scoreboard ranked={ranked} meId={playerId} limit={10} />
          </div>
        )}

        <button
          onClick={onBack}
          className="bg-dominican-red hover:bg-dominican-red-light text-white font-display text-xl px-8 py-3 rounded-2xl shadow-[0_5px_0_#A50E1E] transition-all active:translate-y-1 active:shadow-[0_1px_0_#A50E1E]"
        >
          Salir
        </button>
      </div>
    )
  }

  const gameReady = phase === 'lobby' || phase === 'podium' || !!question

  return (
    <div className="min-h-screen flex flex-col fondo-caribe text-dominican-blue-dark">
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
            <p className="font-display text-lg leading-tight truncate">{room.name}</p>
            {(phase === 'question' || phase === 'reveal') && (
              <p className="text-xs font-semibold text-white/80">
                Pregunta {questionIndex + 1} de {questions.length}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-1.5 rounded-full bg-white/15 hover:bg-white/25"
              title={isMuted ? 'Activar sonido' : 'Silenciar'}
              aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-1.5 text-sm font-bold bg-white/15 rounded-full px-3 py-1">
              <Users className="w-4 h-4" />
              {players.length}
            </div>
          </div>
        </div>
        {/* franja de la bandera */}
        <div className="h-1 bg-white" />
        <div className="h-1.5 bg-dominican-red" />
      </header>

      <main className="flex-1 flex flex-col w-full max-w-4xl mx-auto px-4 pt-4 pb-6">
        {error && (
          <div className="mb-3 px-4 py-3 bg-dominican-red text-white rounded-xl font-semibold text-sm">
            {error}
          </div>
        )}

        {!gameReady ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="loading-spinner"></div>
            <p className="font-bold text-dominican-blue">Cargando el juego…</p>
          </div>
        ) : (
          <>
            {phase === 'lobby' && renderLobby()}
            {phase === 'intro' && renderIntro()}
            {phase === 'question' && renderQuestion()}
            {phase === 'reveal' && renderReveal()}
            {phase === 'podium' && renderPodium()}
          </>
        )}
      </main>
    </div>
  )
}

export default MultiplayerRoom
