import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, Copy, Crown, Play, Trophy, Users, Volume2, VolumeX, X } from 'lucide-react'
import { roomHelpers, realtimeHelpers, sessionHelpers } from '../insforge'
import { Room, Player, Game } from '../types'
import { useGameSounds } from '../hooks/useGameSounds'
import PlayerAvatar from './PlayerAvatar'
import AnswerBadge, { ANSWER_STYLES } from './AnswerBadge'

interface MultiplayerRoomProps {
  room: Room
  player: Player
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

const Scoreboard: React.FC<{ ranked: Player[]; meId: string; limit: number }> = ({ ranked, meId, limit }) => {
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
  } = useGameSounds()

  const roomId = initialRoom.id

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
  const mySavedAnswer = answers.find(a => a.player_id === player.id)
  const selectedAnswer = myAnswer && myAnswer.questionId === questionId ? myAnswer.answer : mySavedAnswer?.answer ?? null

  const ranked = useMemo(
    () => [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.joined_at.localeCompare(b.joined_at)),
    [players]
  )
  const myPosition = ranked.findIndex(p => p.id === player.id)
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
    const graceMs = player.is_host ? 300 : 2500
    const timeIsUp = serverNow >= startAt + limitMs + graceMs

    if ((player.is_host && everyoneAnswered) || timeIsUp) {
      requestReveal()
    }
  }, [phase, question, players.length, answers.length, serverNow, startAt, limitMs, player.is_host, requestReveal])

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
  // varios dispositivos cuando todos juegan en el mismo lugar
  useEffect(() => {
    if (!player.is_host) return
    if (phase === 'lobby') startMusic('lobby')
    else if (phase === 'question') startMusic('countdown')
    else stopMusic()
  }, [phase, player.is_host, startMusic, stopMusic])

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
    if (phase !== 'question' || selectedAnswer !== null || !sessionId || !question) return

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
                p.id === player.id ? 'bg-dominican-blue text-white' : 'bg-white'
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
        {player.is_host ? (
          <>
            <button
              onClick={handleStart}
              disabled={busy || players.length < 2 || !game}
              className="w-full flex items-center justify-center gap-2 bg-dominican-red hover:bg-dominican-red-light text-white font-display text-2xl py-4 rounded-2xl shadow-[0_6px_0_#A50E1E] transition-all active:translate-y-1 active:shadow-[0_2px_0_#A50E1E] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-6 h-6" />
              {busy ? 'Arrancando…' : '¡Arrancar el juego!'}
            </button>
            {players.length < 2 && (
              <p className="text-gray-600 font-semibold text-sm mt-4">Necesitas al menos 2 jugadores para arrancar</p>
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

  const renderQuestion = () => (
    <div className="flex-1 flex flex-col gap-4">
      <h2 className="bg-white text-dominican-blue-dark rounded-2xl shadow-lg border-t-8 border-dominican-red px-5 py-5 text-xl sm:text-3xl font-black text-center">
        {question?.text}
      </h2>

      {question?.image_url && (
        <img src={question.image_url} alt="" className="max-h-56 mx-auto rounded-2xl shadow-lg" />
      )}

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

      <div className="grid grid-cols-2 auto-rows-fr gap-3 flex-1 max-h-[30rem] mt-auto">
        {question?.options.slice(0, 4).map((option, index) => (
          <button
            key={index}
            onClick={() => handleAnswer(index)}
            disabled={selectedAnswer !== null}
            className={`${ANSWER_STYLES[index].bg} tablita flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 sm:gap-4 rounded-2xl border-4 border-white px-3 sm:px-5 py-4 min-h-[6rem] text-center sm:text-left text-white text-base sm:text-2xl font-bold shadow-lg transition-all active:scale-95 ${
              selectedAnswer === null
                ? 'hover:brightness-110 hover:-translate-y-0.5'
                : selectedAnswer === index
                  ? 'ring-4 ring-dominican-blue'
                  : 'opacity-60 saturate-50'
            }`}
          >
            <AnswerBadge icon={ANSWER_STYLES[index].icon} color={ANSWER_STYLES[index].text} className="w-12 h-12 sm:w-14 sm:h-14" />
            <span className="break-words">{option}</span>
          </button>
        ))}
      </div>
    </div>
  )

  const renderReveal = () => {
    const counts = [0, 1, 2, 3].map(index => answers.filter(a => a.answer === index).length)
    const maxCount = Math.max(1, ...counts)
    const isLastQuestion = questionIndex >= questions.length - 1

    return (
      <div className="flex-1 flex flex-col gap-4">
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

        <h2 className="text-center text-lg sm:text-2xl font-black text-dominican-blue-dark">{question?.text}</h2>

        <div className="grid grid-cols-4 gap-3 items-end h-32 px-2">
          {counts.map((count, index) => (
            <div key={index} className="flex flex-col items-center justify-end h-full gap-1">
              <span className="flex items-center gap-1 font-display text-xl text-dominican-blue-dark tabular-nums">
                {count}
                {index === question?.correct_answer && <Check className="w-5 h-5 text-palma" strokeWidth={4} />}
              </span>
              <div
                className={`${ANSWER_STYLES[index].bg} tablita w-full rounded-t-xl transition-[height] duration-500 ${
                  index === question?.correct_answer ? '' : 'opacity-40'
                }`}
                style={{ height: `${Math.max(6, (count / maxCount) * 100)}%` }}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {question?.options.slice(0, 4).map((option, index) => {
            const isCorrect = index === question.correct_answer
            return (
              <div
                key={index}
                className={`flex items-center gap-2 sm:gap-3 rounded-xl border-4 px-2.5 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-xl font-bold shadow ${
                  isCorrect
                    ? `${ANSWER_STYLES[index].bg} tablita border-white text-white`
                    : 'bg-white border-white text-gray-500'
                } ${selectedAnswer === index ? 'ring-4 ring-dominican-blue' : ''}`}
              >
                <AnswerBadge icon={ANSWER_STYLES[index].icon} color={ANSWER_STYLES[index].text} className="w-7 h-7 sm:w-10 sm:h-10" />
                <span className="flex-1 break-words">{option}</span>
                {isCorrect
                  ? <Check className="w-6 h-6 shrink-0" strokeWidth={4} />
                  : <X className="w-6 h-6 shrink-0 text-gray-400" strokeWidth={4} />}
              </div>
            )
          })}
        </div>

        <Scoreboard ranked={ranked} meId={player.id} limit={5} />

        {player.is_host ? (
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

        <p className="bg-dominican-blue text-white rounded-full px-5 py-2 font-bold">
          Quedaste en el puesto {myPosition + 1} con {myScore} puntos
        </p>

        {ranked.length > 3 && (
          <div className="w-full max-w-md">
            <Scoreboard ranked={ranked} meId={player.id} limit={10} />
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
