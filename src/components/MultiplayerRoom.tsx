import React, { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Users, Crown, Play } from 'lucide-react'
// import { useAuth } from '../contexts/AuthContext' // Currently unused
import { roomHelpers, realtimeHelpers, gameHelpers, insforge } from '../insforge'
import { Room, Player, Game } from '../types'
import { useGameSounds } from '../hooks/useGameSounds'
import GameSelector from './GameSelector'
import PlayerAvatar from './PlayerAvatar'

interface MultiplayerRoomProps {
  room: Room
  player: Player
  onBack: () => void
}

type RoomState = 'lobby' | 'game-select' | 'playing' | 'results' | 'finished'
type GameState = 'waiting' | 'question' | 'answer' | 'leaderboard'

const MultiplayerRoom: React.FC<MultiplayerRoomProps> = ({ room: initialRoom, player, onBack }) => {
  // const { user } = useAuth() // Currently unused
  const { 
    playCorrect, 
    playIncorrect, 
    playTick, 
    playTimeUp, 
    playGameStart,
    initializeAudio,
    isAudioEnabled 
  } = useGameSounds()

  // Estados principales
  const [room, setRoom] = useState<Room>(initialRoom)
  const [players, setPlayers] = useState<Player[]>([])
  const [roomState, setRoomState] = useState<RoomState>(
    initialRoom.status === 'playing' && (initialRoom.current_game_data || initialRoom.game) ? 'playing' : 'lobby'
  )
  const [gameState, setGameState] = useState<GameState>(
    initialRoom.status === 'playing' && (initialRoom.current_game_data || initialRoom.game) ? 'question' : 'waiting'
  )
  const [games, setGames] = useState<Game[]>([])
  
  // Estados del juego
  const [currentGame, setCurrentGame] = useState<Game | null>(
    initialRoom.current_game_data || initialRoom.game || null
  )
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(30)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [playerAnswers, setPlayerAnswers] = useState<{[playerId: string]: number | null}>({})
  const [playerAnswerTimes, setPlayerAnswerTimes] = useState<{[playerId: string]: number}>({}) // Tiempo que tardó en responder
  const [questionStartTime, setQuestionStartTime] = useState<number>(0) // Timestamp de inicio de pregunta
  const [waitingForPlayers, setWaitingForPlayers] = useState(false)
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(0)
  const [hasTimedOut, setHasTimedOut] = useState(false)
  const [gameResults, setGameResults] = useState<{[playerId: string]: {correct: number, total: number, score: number}}>({})  
  
  // Estados de la UI
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cargar jugadores inicial y juegos
  useEffect(() => {
    loadPlayers()
    loadGames()
    
    // Si ya hay un juego cargado, inicializar timer
    if ((initialRoom.game || initialRoom.current_game_data) && roomState === 'playing') {
      const gameToUse = initialRoom.current_game_data || initialRoom.game
      setTimeLeft(gameToUse?.questions?.[0]?.time_limit || 30)
      console.log('🎯 Initial game loaded:', gameToUse?.title, 'Questions:', gameToUse?.questions?.length)
    }
    
    // IMPORTANTE: Si el participante se une a una sala ya en progreso, cargar el juego inmediatamente
    if (!player.is_host && initialRoom.status === 'playing' && roomState === 'playing') {
      console.log('🔄 Participant joining active game - loading immediately')
      loadGameForParticipant()
    }
  }, [])

  // Inicializar audio con primera interacción del usuario
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!isAudioEnabled) {
        initializeAudio().then(success => {
          if (success) {
            console.log('Audio inicializado correctamente en MultiplayerRoom')
          }
        })
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

  // Suscribirse a cambios en jugadores
  useEffect(() => {
    const subscription = realtimeHelpers.subscribeToRoomPlayers(
      room.id,
      (payload) => {
        console.log('Players changed:', payload)
        loadPlayers()
      }
    )

    return () => {
      realtimeHelpers.unsubscribe(subscription)
    }
  }, [room.id])

  // Suscribirse a cambios en la sala
  useEffect(() => {
    const subscription = realtimeHelpers.subscribeToRoom(
      room.id,
      (payload) => {
        console.log('🔄 Room changed:', payload)
        console.log('🎮 Current player:', player.name, 'Is host:', player.is_host)
        
        if (payload.new?.status !== room.status) {
          console.log('📦 Room update payload:', payload.new)
          setRoom(prev => ({ ...prev, ...payload.new }))
          
          if (payload.new.status === 'playing') {
            console.log('🚀 Starting game for:', player.name)
            
            if (player.is_host) {
              // El host ya tiene el juego, no necesita cargarlo de nuevo
              console.log('🏠 Host already has game, skipping load')
              setRoomState('playing')
              setGameState('question')
            } else {
              // Los participantes necesitan cargar el juego desde múltiples fuentes
              console.log('👥 Participant needs to load game immediately')
              loadGameForParticipant()
            }
          }
        }
        
        // RESPALDO: Detectar cambios en current_question_index como sincronización alternativa
        if (!player.is_host && payload.new?.current_question_index !== undefined && 
            payload.new.current_question_index !== room.current_question_index &&
            roomState === 'playing' && currentGame?.questions) {
          
          const newQuestionIndex = payload.new.current_question_index
          console.log(`🔄 [${player.name}] BACKUP SYNC: Room question index changed to ${newQuestionIndex}`)
          
          if (newQuestionIndex >= 0 && newQuestionIndex < currentGame.questions.length) {
            console.log(`🔄 [${player.name}] BACKUP SYNC: Updating to question ${newQuestionIndex + 1}`)
            setCurrentQuestionIndex(newQuestionIndex)
            setGameState('question')
            setTimeLeft(currentGame.questions[newQuestionIndex].time_limit || 30)
            setShowAnswer(false)
            setSelectedAnswer(null)
            setPlayerAnswers({})
            setWaitingForPlayers(false)
            setError(null)
          }
        }
        
        // Actualizar estado de la sala en todos los casos
        setRoom(prev => ({ ...prev, ...payload.new }))
      }
    )

    return () => {
      realtimeHelpers.unsubscribe(subscription)
    }
  }, [room.id])

  // Suscribirse a cambios en game_sessions para recibir el juego (TODOS los jugadores)
  useEffect(() => {
    console.log('🔗 Setting up game session subscription for:', player.name, 'Room:', room.id)
    
    const subscription = realtimeHelpers.subscribeToGameSession(
      room.id,
      async (payload) => {
        console.log('🎯 Game session changed for', player.name, ':', payload)
        
        if (payload.eventType === 'INSERT' && payload.new) {
          // Se creó una nueva sesión de juego
          console.log(`🎮 New game session detected for ${player.name}`)
          
          if (!player.is_host) {
            // Los participantes cargan inmediatamente el juego
            console.log('🔄 Participant loading game immediately after session creation')
            await loadGameForParticipant()
          }
        }
      }
    )

    return () => {
      realtimeHelpers.unsubscribe(subscription)
    }
  }, [room.id, player.is_host, player.name])

  // Suscribirse a Broadcast Channel para recibir datos de juego y sincronización
  useEffect(() => {
    const channelName = `game-${room.id}`
    console.log(`📡 [${player.name}] Setting up BroadcastChannel: ${channelName}`)
    
    const gameChannel = new BroadcastChannel(channelName)
    
    gameChannel.onmessage = (event) => {
      console.log(`📡 [${player.name}] Broadcast message received:`, event.data)
      console.log(`📡 [${player.name}] Current state: roomState=${roomState}, gameState=${gameState}, questionIndex=${currentQuestionIndex}`)
      
      if (event.data.type === 'GAME_DATA' && event.data.game) {
        console.log('✅ Game data received via broadcast:', event.data.game.title, 'Questions:', event.data.game.questions?.length)
        if (!player.is_host) { // Solo participantes procesan GAME_DATA
          setCurrentGame(event.data.game)
          if (roomState === 'playing') {
            setGameState('question')
            setTimeLeft(event.data.game.questions?.[0]?.time_limit || 30)
            setError(null)
          }
        }
      }
      
      // Sincronización de estado de juego (TODOS los jugadores escuchan)
      if (event.data.type === 'GAME_STATE_SYNC' && !player.is_host) {
        console.log(`🔄 [${player.name}] Game state sync received:`, event.data)
        
        const { 
          questionIndex, 
          gameState: newGameState, 
          timeLeft: newTimeLeft, 
          showAnswer: newShowAnswer,
          gameEnded,
          timestamp,
          questionStartTime: syncedStartTime // Timestamp sincronizado del host
        } = event.data
        
        console.log(`🔄 [${player.name}] Current state: Q${currentQuestionIndex}, New state: Q${questionIndex}`)
        
        // Ignorar mensajes duplicados o antiguos
        if (timestamp && timestamp <= lastSyncTimestamp) {
          console.log(`📝 [${player.name}] Ignoring duplicate/old sync message`)
          return
        }
        
        if (timestamp) {
          setLastSyncTimestamp(timestamp)
        }
        
        // Manejar fin del juego
        if (gameEnded) {
          console.log('🏁 Participant syncing to game end')
          setRoomState('results')
          setGameState('leaderboard')
          return
        }
        
        // Sincronizar estado solo si no es el host
        console.log(`🔄 [${player.name}] Syncing: Q${currentQuestionIndex} → Q${questionIndex}, gameState: ${newGameState}, showAnswer: ${newShowAnswer}`)
        
        setCurrentQuestionIndex(questionIndex)
        setGameState(newGameState)
        setTimeLeft(newTimeLeft)
        setShowAnswer(newShowAnswer)
        
        // Solo resetear selectedAnswer si es una nueva pregunta (diferente índice)
        if (questionIndex !== currentQuestionIndex) {
          setSelectedAnswer(null) // Resetear respuesta del participante
          setPlayerAnswers({}) // Limpiar respuestas anteriores
          setPlayerAnswerTimes({}) // Limpiar tiempos de respuesta
          setHasTimedOut(false) // Resetear estado de timeout
          
          // Usar el questionStartTime sincronizado del host si está disponible
          if (syncedStartTime) {
            console.log(`⏰ [${player.name}] Using synced start time from host: ${syncedStartTime}`)
            setQuestionStartTime(syncedStartTime)
          } else {
            console.log(`⏰ [${player.name}] No synced start time, using current time`)
            setQuestionStartTime(Date.now())
          }
        }
        
        setWaitingForPlayers(false)
        setError(null)
        
        console.log(`✅ [${player.name}] Participant synced to question ${questionIndex + 1}, timeLeft: ${newTimeLeft}s`)
      }
      
      // Sincronización del temporizador (solo participantes)
      if (event.data.type === 'TIMER_SYNC' && !player.is_host) {
        const { timeLeft: syncedTime, questionIndex: syncedQuestionIndex } = event.data
        
        // Solo sincronizar si estamos en la misma pregunta y no se está mostrando la respuesta
        if (syncedQuestionIndex === currentQuestionIndex && !showAnswer) {
          setTimeLeft(syncedTime)
          console.log(`🕒 Participant timer synced: ${syncedTime}s`)
        }
      }
    }
    
    return () => {
      gameChannel.close()
    }
  }, [room.id, player.is_host, roomState, currentQuestionIndex, showAnswer])

  // Suscribirse al canal en tiempo real de la sala para sincronización de estado del juego
  useEffect(() => {
    if (!room.id) return

    console.log(`📡 [${player.name}] Setting up real-time game sync for room: ${room.id}`)
    
    const syncSubscription = realtimeHelpers.subscribeToGameSync(room.id, 'game_state_sync', (data) => {
      console.log(`📡 [${player.name}] Real-time message received:`, data)
      
      if (player.is_host) {
        console.log(`📡 [${player.name}] Host ignoring own sync message`)
        return
      }
      
      if (!data || data.sender === player.name) {
        console.log(`📡 [${player.name}] Ignoring message from self`)
        return
      }
      
      console.log(`🔄 [${player.name}] Processing InsForge sync:`, data)
      
      // Procesar el mensaje de sincronización igual que BroadcastChannel
      if (data.type === 'GAME_STATE_SYNC') {
        const { 
          questionIndex, 
          gameState: newGameState, 
          timeLeft: newTimeLeft, 
          showAnswer: newShowAnswer,
          gameEnded,
          timestamp,
          questionStartTime: syncedStartTime // Timestamp sincronizado del host
        } = data
        
        console.log(`🔄 [${player.name}] InsForge sync: Q${currentQuestionIndex} → Q${questionIndex}`)
        
        // Ignorar mensajes duplicados o antiguos
        if (timestamp && timestamp <= lastSyncTimestamp) {
          console.log(`📝 [${player.name}] Ignoring old InsForge sync message`)
          return
        }
        
        if (timestamp) {
          setLastSyncTimestamp(timestamp)
        }
        
        // Manejar fin del juego
        if (gameEnded) {
          console.log(`🏁 [${player.name}] InsForge sync: Game ended`)
          setRoomState('results')
          setGameState('leaderboard')
          return
        }
        
        // Sincronizar estado
        console.log(`🔄 [${player.name}] InsForge syncing: Q${currentQuestionIndex} → Q${questionIndex}, gameState: ${newGameState}, showAnswer: ${newShowAnswer}`)
        
        setCurrentQuestionIndex(questionIndex)
        setGameState(newGameState)
        setTimeLeft(newTimeLeft)
        setShowAnswer(newShowAnswer)
        
        // Solo resetear selectedAnswer si es una nueva pregunta (diferente índice)
        if (questionIndex !== currentQuestionIndex) {
          setSelectedAnswer(null)
          setPlayerAnswers({})
          setPlayerAnswerTimes({})
          setHasTimedOut(false)
          
          // Usar el questionStartTime sincronizado del host si está disponible
          if (syncedStartTime) {
            console.log(`⏰ [${player.name}] InsForge: Using synced start time from host: ${syncedStartTime}`)
            setQuestionStartTime(syncedStartTime)
          } else {
            console.log(`⏰ [${player.name}] InsForge: No synced start time, using current time`)
            setQuestionStartTime(Date.now())
          }
        }
        
        setWaitingForPlayers(false)
        setError(null)
        
        console.log(`✅ [${player.name}] InsForge sync completed to question ${questionIndex + 1}, timeLeft: ${newTimeLeft}s`)
      }
    })
    
    // Escuchar respuestas de otros jugadores
    const answerSubscription = realtimeHelpers.subscribeToGameSync(room.id, 'player_answer', (data) => {
      console.log(`📡 [${player.name}] Player answer received:`, data)
      
      if (!data || data.player_id === player.id) {
        console.log(`📡 [${player.name}] Ignoring own answer`)
        return
      }
      
      if (data.question_index !== currentQuestionIndex) {
        console.log(`📡 [${player.name}] Answer for different question, ignoring`)
        return
      }
      
      console.log(`📝 [${player.name}] Recording answer from ${data.player_name}: ${data.answer_index}, time: ${data.answer_time}ms`)
      
      // Actualizar respuestas y tiempos de otros jugadores
      setPlayerAnswers(prev => ({
        ...prev,
        [data.player_id]: data.answer_index
      }))
      
      if (data.answer_time !== undefined) {
        setPlayerAnswerTimes(prev => ({
          ...prev,
          [data.player_id]: data.answer_time
        }))
      }
    })
    
    return () => {
      console.log(`📡 [${player.name}] Cleaning up real-time game sync`)
      realtimeHelpers.unsubscribe(syncSubscription)
      realtimeHelpers.unsubscribe(answerSubscription)
    }
  }, [room.id, player.name, player.is_host, currentQuestionIndex, lastSyncTimestamp])

  // Verificar si todos han respondido cuando las respuestas cambien
  useEffect(() => {
    if (gameState !== 'question' || showAnswer) return
    
    const totalConnectedPlayers = players.filter(p => p.id).length
    const answeredPlayers = Object.keys(playerAnswers).filter(id => playerAnswers[id] !== null).length
    
    console.log(`📊 [${player.name}] Answer check: ${answeredPlayers}/${totalConnectedPlayers} players answered`)
    console.log(`📊 [${player.name}] Current answers:`, playerAnswers)
    
    if (totalConnectedPlayers > 0 && answeredPlayers === totalConnectedPlayers) {
      console.log(`🎯 [${player.name}] All players have answered! Showing answers.`)
      setShowAnswer(true)
      setWaitingForPlayers(false)
      
      // Solo el host sincroniza el estado de "mostrar respuestas"
      if (player.is_host) {
        console.log(`📡 [HOST-${player.name}] Broadcasting show answer state to all players`)
        
        const broadcastMessage = {
          type: 'GAME_STATE_SYNC',
          questionIndex: currentQuestionIndex,
          gameState: 'question',
          timeLeft: timeLeft,
          showAnswer: true,
          timestamp: Date.now()
        }
        
        // Enviar via InsForge Realtime
        realtimeHelpers.sendGameSync(room.id, 'game_state_sync', {
          ...broadcastMessage,
          sender: player.name,
          room_id: room.id
        }).then(() => {
          console.log(`✅ [HOST-${player.name}] Show answer state broadcasted`)
        }).catch((err) => {
          console.error('Error broadcasting show answer:', err)
        })
      }
    }
  }, [playerAnswers, players, gameState, showAnswer, currentQuestionIndex, timeLeft, player.is_host, player.name, room.id])

  // Función para calcular puntos basados en velocidad y corrección
  const calculatePoints = (isCorrect: boolean, timeLimit: number, answerTime: number): number => {
    if (!isCorrect) return 0
    
    // Puntos base por respuesta correcta
    const basePoints = 500
    
    // Convertir timeLimit a milisegundos
    const timeLimitMs = timeLimit * 1000
    
    // Puntos bonus por velocidad (máximo 500 puntos adicionales)
    // Fórmula: bonus = 500 * (tiempo restante / tiempo límite)
    // Respuesta instantánea = 500 bonus, respuesta al final = 0 bonus
    const timeRemaining = timeLimitMs - answerTime
    const timeBonus = Math.floor(500 * (timeRemaining / timeLimitMs))
    
    const totalPoints = basePoints + Math.max(0, timeBonus)
    
    console.log(`💯 Points calculation:`)
    console.log(`   - Time limit: ${timeLimit}s (${timeLimitMs}ms)`)
    console.log(`   - Answer time: ${answerTime}ms (${(answerTime/1000).toFixed(2)}s)`)
    console.log(`   - Time remaining: ${timeRemaining}ms`)
    console.log(`   - Base points: ${basePoints}`)
    console.log(`   - Time bonus: ${timeBonus}`)
    console.log(`   - Total points: ${totalPoints}`)
    
    return totalPoints
  }

  // Calcular resultados cuando se muestren las respuestas (sin incluir gameResults en dependencias para evitar loops)
  useEffect(() => {
    if (showAnswer && gameState === 'question' && currentGame?.questions?.[currentQuestionIndex]) {
      const currentQuestion = currentGame.questions[currentQuestionIndex]
      const timeLimit = currentQuestion.time_limit || 30
      
      console.log('📊 Calculating results for question:', currentQuestionIndex)
      console.log('📊 Player answers:', playerAnswers)
      console.log('📊 Player answer times:', playerAnswerTimes)
      
      setGameResults(prevResults => {
        const newResults = { ...prevResults }
        
        players.forEach(p => {
          if (!newResults[p.id]) {
            newResults[p.id] = { correct: 0, total: 0, score: 0 }
          }
          
          const playerAnswer = playerAnswers[p.id]
          const answerTime = playerAnswerTimes[p.id] || (timeLimit * 1000) // Si no hay tiempo, usar el límite
          const isCorrect = playerAnswer === currentQuestion.correct_answer
          
          console.log(`📊 Player ${p.name}:`, {
            answer: playerAnswer,
            answerTime: answerTime,
            answerTimeSeconds: (answerTime / 1000).toFixed(2),
            correctAnswer: currentQuestion.correct_answer,
            isCorrect
          })
          
          // Solo actualizar si esta pregunta no se ha contado aún
          if (newResults[p.id].total <= currentQuestionIndex) {
            newResults[p.id].total += 1
            if (isCorrect) {
              newResults[p.id].correct += 1
              const points = calculatePoints(isCorrect, timeLimit, answerTime)
              newResults[p.id].score += points
              console.log(`📊 Player ${p.name}: +${points} points (total: ${newResults[p.id].score})`)
            } else {
              console.log(`📊 Player ${p.name}: 0 points (incorrect answer)`)
            }
          }
        })
        
        console.log('📊 Updated game results:', newResults)
        return newResults
      })
    }
  }, [showAnswer, gameState, currentQuestionIndex, currentGame, players, playerAnswers, playerAnswerTimes])

  // Efecto especial para el host: iniciar el juego automáticamente si ya tiene los datos
  useEffect(() => {
    if (player.is_host && roomState === 'playing' && currentGame && gameState === 'waiting') {
      console.log('🏠 Host auto-starting game with current data')
      setGameState('question')
      setQuestionStartTime(Date.now()) // Iniciar cronómetro
      if (currentGame.questions?.[0]) {
        setTimeLeft(currentGame.questions[0].time_limit || 30)
      }
    }
  }, [player.is_host, roomState, currentGame, gameState])

  // Efecto de recuperación para participantes: intentar cargar el juego cada 2 segundos si no tiene preguntas
  useEffect(() => {
    if (player.is_host || roomState !== 'playing' || gameState !== 'question') return
    
    // Si el participante está en un juego activo pero no tiene preguntas, intentar cargar
    if (!currentGame?.questions?.length) {
      console.log('🔄 Participant missing questions - attempting recovery')
      const recoveryInterval = setInterval(() => {
        console.log('🔄 Recovery attempt for participant')
        loadGameForParticipant()
      }, 2000)

      // Limpiar el interval después de 30 segundos o cuando se obtengan las preguntas
      const timeout = setTimeout(() => {
        clearInterval(recoveryInterval)
        console.log('⏰ Recovery timeout reached')
      }, 30000)

      return () => {
        clearInterval(recoveryInterval)
        clearTimeout(timeout)
      }
    }
  }, [player.is_host, roomState, gameState, currentGame?.questions?.length])

  // Timer del juego (solo el host maneja el timer principal)
  useEffect(() => {
    if (gameState !== 'question' || showAnswer) return

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        // Si el jugador ya respondió, NO actualizar el temporizador para él (mantenerlo congelado)
        if (selectedAnswer !== null && !player.is_host) {
          console.log(`⏰ [${player.name}] Timer frozen - player already answered`)
          return prev // Mantener el tiempo actual sin decrementar
        }
        
        // Si el jugador ya respondió, no ejecutar handleTimeUp para él
        if (prev <= 1) {
          // Solo ejecutar handleTimeUp si el jugador no ha respondido o es el host
          if (selectedAnswer === null || player.is_host) {
            handleTimeUp()
          } else {
            console.log(`⏰ [${player.name}] Timer ended but player already answered, ignoring`)
          }
          return 0
        }
        
        const newTime = prev - 1
        
        // Sonidos del temporizador solo si no ha respondido - evitar spam
        if (selectedAnswer === null) {
          if (newTime === 10) {
            // Un solo tick a los 10 segundos
            playTick()
          } else if (newTime <= 5 && newTime > 0) {
            // Tick en los últimos 5 segundos
            playTick()
          }
        }
        
        // El host sincroniza el temporizador cada 5 segundos
        if (player.is_host && newTime % 5 === 0 && newTime > 0) {
          console.log(`🕒 HOST syncing timer: ${newTime}s`)
          const gameChannel = new BroadcastChannel(`game-${room.id}`)
          gameChannel.postMessage({
            type: 'TIMER_SYNC',
            timeLeft: newTime,
            questionIndex: currentQuestionIndex
          })
          
          setTimeout(() => gameChannel.close(), 100)
        }
        
        return newTime
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [gameState, showAnswer, playTick, player.is_host, currentQuestionIndex, selectedAnswer, room.id, player.name])

  const loadPlayers = async () => {
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

  const loadGameForParticipant = async () => {
    console.log('🔄 Loading game for participant using multiple strategies...')
    console.log('🔄 Current state:', { hasCurrentGame: !!currentGame, hasQuestions: !!currentGame?.questions?.length })
    
    // Si ya tenemos el juego con preguntas, no hacer nada
    if (currentGame?.questions?.length) {
      console.log('✅ Game already loaded with questions, skipping')
      return
    }
    
    // Estrategia 1: localStorage
    try {
      console.log('🔄 Strategy 1: Checking localStorage...')
      const storedGameData = localStorage.getItem(`game-data-${room.id}`)
      if (storedGameData) {
        const gameData = JSON.parse(storedGameData)
        if (gameData && gameData.questions && gameData.questions.length > 0) {
          console.log('✅ Game loaded from localStorage:', gameData.title, 'Questions:', gameData.questions.length)
          setCurrentGame(gameData)
          setRoomState('playing')
          setGameState('question')
          setTimeLeft(gameData.questions[0]?.time_limit || 30)
          setError(null)
          return true
        }
      }
      console.log('⚠️ No valid localStorage data')
    } catch (err) {
      console.log('⚠️ localStorage error:', err)
    }
    
    // Estrategia 2: Obtener game_session para obtener game_id
    try {
      console.log('🔄 Strategy 2: Getting game session to find game_id...')
      const { data: sessionData, error: sessionError } = await roomHelpers.getRoomGameSession(room.id)
      
      if (sessionError) {
        console.log('⚠️ Session query error:', sessionError)
      } else if (sessionData && sessionData.game_id) {
        console.log('🔄 Found game_id:', sessionData.game_id, 'trying direct fetch...')
        
        // Usar el game_id para obtener el juego completo
        const { data: gameData, error: gameError } = await insforge.database
          .from('games')
          .select('*, questions(*)')
          .eq('id', sessionData.game_id)
          .single()
        
        if (gameError) {
          console.log('⚠️ Game fetch error:', gameError)
        } else if (gameData && gameData.questions && gameData.questions.length > 0) {
          console.log('✅ Game loaded via session + direct fetch:', gameData.title, 'Questions:', gameData.questions.length)
          setCurrentGame(gameData)
          setRoomState('playing')
          setGameState('question')
          setTimeLeft(gameData.questions[0]?.time_limit || 30)
          setError(null)
          return true
        } else {
          console.log('⚠️ Game found but no questions:', gameData)
        }
      } else {
        console.log('⚠️ No session data found')
      }
    } catch (err) {
      console.log('⚠️ Session + direct fetch failed:', err)
    }
    
    // Estrategia 3: Broadcast Channel (escuchar por un momento)
    try {
      console.log('🔄 Strategy 3: Attempting Broadcast Channel...')
      const gameChannel = new BroadcastChannel(`game-${room.id}`)
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          gameChannel.close()
          console.log('⚠️ Broadcast Channel timeout')
          resolve(false)
        }, 3000)
        
        gameChannel.onmessage = (event) => {
          if (event.data.type === 'GAME_DATA' && event.data.game && event.data.game.questions) {
            console.log('✅ Game received via Broadcast Channel:', event.data.game.title, 'Questions:', event.data.game.questions.length)
            setCurrentGame(event.data.game)
            setRoomState('playing')
            setGameState('question')
            setTimeLeft(event.data.game.questions[0]?.time_limit || 30)
            setError(null)
            clearTimeout(timeout)
            gameChannel.close()
            resolve(true)
          }
        }
        
        // Solicitar datos del juego
        gameChannel.postMessage({ type: 'REQUEST_GAME_DATA' })
      })
    } catch (err) {
      console.log('⚠️ Broadcast Channel failed:', err)
    }
    
    // Estrategia 4: Error state
    console.error('❌ All strategies failed for participant')
    setError('Conectando al juego... Si el problema persiste, recarga la página.')
    return false
  }

  const handleStartGameSetup = () => {
    setRoomState('game-select')
  }

  const handleGameSelected = async (selectedGame: Game) => {
    try {
      setLoading(true)
      setError(null)
      
      // Crear sesión de juego
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
      
      // Cargar el juego completo con sus preguntas
      const { data: fullGameData, error: gameError } = await gameHelpers.getGameWithQuestions(selectedGame.id)
      
      if (gameError || !fullGameData) {
        setError('Error al cargar las preguntas del juego')
        console.error('Game loading error:', gameError)
        return
      }
      
      console.log('✅ Full game data loaded:', fullGameData)
      console.log('✅ Questions count:', fullGameData.questions?.length || 0)
      
      setCurrentGame(fullGameData)
      setRoom(prev => ({ ...prev, status: 'playing' }))
      
      // Iniciar el juego directamente
      setRoomState('playing')
      setGameState('question')
      setCurrentQuestionIndex(0)
      setTimeLeft(fullGameData.questions?.[0]?.time_limit || 30)
      setQuestionStartTime(Date.now()) // Iniciar cronómetro de la primera pregunta
      playGameStart()
    } catch (err) {
      setError('Error al iniciar el juego')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }


  const handleAnswerSelect = useCallback((answerIndex: number) => {
    if (selectedAnswer !== null || showAnswer || waitingForPlayers) return

    // Calcular tiempo de respuesta
    const answerTime = Date.now() - questionStartTime
    console.log(`📝 [${player.name}] Player selected answer: ${answerIndex}, time: ${answerTime}ms`)
    console.log(`📝 [${player.name}] Player has now answered, should not receive time up messages`)
    setSelectedAnswer(answerIndex)
    
    const currentQuestion = currentGame?.questions?.[currentQuestionIndex]
    if (!currentQuestion) return

    // Actualizar las respuestas y tiempos locales
    const newPlayerAnswers = {
      ...playerAnswers,
      [player.id]: answerIndex
    }
    setPlayerAnswers(newPlayerAnswers)
    
    setPlayerAnswerTimes(prev => ({
      ...prev,
      [player.id]: answerTime
    }))
    
    // Reproducir sonido basado en si es correcto
    const isCorrect = answerIndex === currentQuestion.correct_answer
    if (isCorrect) {
      playCorrect()
    } else {
      playIncorrect()
    }

    // Enviar respuesta a todos los jugadores via InsForge Realtime
    try {
      console.log(`📤 [${player.name}] Sending answer to other players`)
      realtimeHelpers.sendGameSync(room.id, 'player_answer', {
        player_id: player.id,
        player_name: player.name,
        answer_index: answerIndex,
        answer_time: answerTime,
        question_index: currentQuestionIndex,
        room_id: room.id,
        timestamp: Date.now()
      }).then(() => {
        console.log(`✅ [${player.name}] Answer sent to other players`)
      }).catch((err) => {
        console.error('Error sending answer:', err)
      })
    } catch (err) {
      console.error('Error in answer sync:', err)
    }
    
    // Verificar si todos los jugadores conectados han respondido
    const totalConnectedPlayers = players.filter(p => p.id).length // Solo jugadores con ID válido
    const answeredPlayers = Object.keys(newPlayerAnswers).filter(id => newPlayerAnswers[id] !== null).length
    
    console.log(`📊 [${player.name}] Progreso respuestas: ${answeredPlayers}/${totalConnectedPlayers} jugadores conectados`)
    console.log(`📊 [${player.name}] Jugadores en sala:`, players.map(p => `${p.name}(${p.id})`))
    console.log(`📊 [${player.name}] Respuestas recibidas:`, Object.keys(newPlayerAnswers))
    
    // La verificación de "todos han respondido" ahora se maneja en el useEffect
    // para incluir respuestas que llegan de otros jugadores via Real-time
    if (answeredPlayers < totalConnectedPlayers) {
      // Aún esperando respuestas de otros jugadores
      setWaitingForPlayers(true)
      console.log(`⏳ [${player.name}] Waiting for other players to answer`)
    }
  }, [selectedAnswer, showAnswer, waitingForPlayers, player.name, player.id, currentGame, currentQuestionIndex, playerAnswers, playCorrect, playIncorrect, room.id, players, questionStartTime])

  const handleTimeUp = useCallback(() => {
    if (showAnswer) return
    
    console.log(`⏰ [${player.name}] handleTimeUp called - selectedAnswer: ${selectedAnswer}`)
    
    // Solo ejecutar lógica de tiempo agotado si este jugador no ha respondido
    if (selectedAnswer === null) {
      console.log(`⏰ [${player.name}] Player didn't answer, playing time up sound`)
      playTimeUp()
      setHasTimedOut(true) // Marcar que hubo timeout específicamente
      
      setPlayerAnswers(prev => ({
        ...prev,
        [player.id]: null
      }))
      
      // Registrar tiempo máximo (tiempo agotado)
      const currentQuestion = currentGame?.questions?.[currentQuestionIndex]
      const timeLimit = currentQuestion?.time_limit || 30
      setPlayerAnswerTimes(prev => ({
        ...prev,
        [player.id]: timeLimit * 1000
      }))
      
      // Enviar respuesta "sin respuesta" a otros jugadores
      try {
        realtimeHelpers.sendGameSync(room.id, 'player_answer', {
          player_id: player.id,
          player_name: player.name,
          answer_index: null, // Sin respuesta por tiempo agotado
          answer_time: timeLimit * 1000,
          question_index: currentQuestionIndex,
          room_id: room.id,
          timestamp: Date.now()
        }).catch((err) => {
          console.error('Error sending timeout answer:', err)
        })
      } catch (err) {
        console.error('Error sending timeout answer:', err)
      }
    } else {
      console.log(`⏰ [${player.name}] Player already answered, skipping time up logic`)
    }
    
    // El host siempre maneja la sincronización de "tiempo agotado" general
    if (player.is_host) {
      console.log(`⏰ [HOST-${player.name}] Time up - checking if should show answers`)
      setShowAnswer(true)
      setWaitingForPlayers(false)
    }
    
    // SINCRONIZAR tiempo agotado si soy el host (múltiples intentos)
    if (player.is_host) {
      console.log('⏰ HOST broadcasting time up state')
      
      const broadcastMessage = {
        type: 'GAME_STATE_SYNC',
        questionIndex: currentQuestionIndex,
        gameState: 'question',
        timeLeft: 0,
        showAnswer: true,
        timestamp: Date.now()
      }
      
      // Enviar múltiples veces para asegurar llegada
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const gameChannel = new BroadcastChannel(`game-${room.id}`)
          gameChannel.postMessage(broadcastMessage)
          setTimeout(() => gameChannel.close(), 100)
        }, i * 200)
      }
      
      // NO avanzar automáticamente - esperar que el host presione el botón
      console.log('⏰ Time up, waiting for host to advance')
    }
    
    // TODO: Registrar respuesta por tiempo agotado
  }, [showAnswer, selectedAnswer, player.name, player.is_host, playTimeUp, room.id, currentQuestionIndex, timeLeft])

  const handleNextQuestion = () => {
    if (!currentGame?.questions) return

    const nextIndex = currentQuestionIndex + 1
    
    if (nextIndex < currentGame.questions.length) {
      // Resetear estados para la siguiente pregunta
      const newTimeLimit = currentGame.questions[nextIndex].time_limit || 30
      
      setCurrentQuestionIndex(nextIndex)
      setSelectedAnswer(null)
      setShowAnswer(false)
      setPlayerAnswers({}) // Limpiar respuestas anteriores
      setPlayerAnswerTimes({}) // Limpiar tiempos de respuesta
      setWaitingForPlayers(false)
      setTimeLeft(newTimeLimit)
      setGameState('question')
      setHasTimedOut(false) // Resetear estado de timeout
      
      // Iniciar cronómetro para nueva pregunta y guardarlo para sincronización
      const newQuestionStartTime = Date.now()
      setQuestionStartTime(newQuestionStartTime)
      
      // SINCRONIZAR con todos los participantes si soy el host (múltiples intentos para garantizar llegada)
      if (player.is_host) {
        console.log(`🎯 [HOST-${player.name}] Broadcasting next question: ${nextIndex + 1} of ${currentGame.questions.length}`)
        
        const broadcastMessage = {
          type: 'GAME_STATE_SYNC',
          questionIndex: nextIndex,
          gameState: 'question',
          timeLeft: newTimeLimit,
          showAnswer: false,
          timestamp: Date.now(),
          totalQuestions: currentGame.questions.length,
          questionStartTime: newQuestionStartTime // Enviar tiempo de inicio sincronizado
        }
        
        console.log(`🎯 [HOST-${player.name}] Broadcast message:`, broadcastMessage)
        
        // Enviar el mensaje múltiples veces para asegurar llegada con mayor frecuencia
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            const channelName = `game-${room.id}`
            const gameChannel = new BroadcastChannel(channelName)
            console.log(`📤 [HOST-${player.name}] Sending broadcast attempt ${i + 1}/5 on channel: ${channelName}`)
            console.log(`📤 [HOST-${player.name}] Message content:`, broadcastMessage)
            gameChannel.postMessage(broadcastMessage)
            setTimeout(() => gameChannel.close(), 100)
          }, i * 100) // Reducir tiempo entre intentos a 100ms
        }
        
        // MÉTODO PRINCIPAL: Actualizar base de datos para sincronización confiable
        try {
          console.log(`💾 [HOST-${player.name}] Updating room current_question_index for sync`)
          insforge.database
            .from('rooms')
            .update({ 
              current_question_index: nextIndex
            })
            .eq('id', room.id)
            .then(({ error }) => {
              if (error) {
                console.error('Error updating room question index:', error)
              } else {
                console.log(`✅ [HOST-${player.name}] Room question index updated to ${nextIndex}`)
              }
            })
        } catch (err) {
          console.error('Error in database sync:', err)
        }
        
        // MÉTODO ADICIONAL: Usar InsForge Realtime para comunicación inmediata
        try {
          console.log(`📡 [HOST-${player.name}] Sending real-time sync via InsForge channel`)
          realtimeHelpers.sendGameSync(room.id, 'game_state_sync', {
            ...broadcastMessage,
            sender: player.name,
            room_id: room.id
          }).then(() => {
            console.log(`✅ [HOST-${player.name}] Real-time message sent`)
          }).catch((err) => {
            console.error('Error sending real-time message:', err)
          })
        } catch (err) {
          console.error('Error in real-time sync:', err)
        }
      }
    } else {
      setRoomState('results')
      setGameState('leaderboard')
      
      // SINCRONIZAR fin del juego si soy el host (múltiples intentos)
      if (player.is_host) {
        console.log('🏁 HOST broadcasting game end')
        
        const broadcastMessage = {
          type: 'GAME_STATE_SYNC',
          questionIndex: nextIndex,
          gameState: 'leaderboard',
          timeLeft: 0,
          showAnswer: false,
          gameEnded: true,
          timestamp: Date.now()
        }
        
        // Enviar múltiples veces via BroadcastChannel para asegurar llegada
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            const gameChannel = new BroadcastChannel(`game-${room.id}`)
            gameChannel.postMessage(broadcastMessage)
            setTimeout(() => gameChannel.close(), 100)
          }, i * 200)
        }
        
        // MÉTODO ADICIONAL: Enviar via InsForge Realtime para mayor confiabilidad
        try {
          console.log(`📡 [HOST-${player.name}] Sending game end via InsForge Realtime`)
          realtimeHelpers.sendGameSync(room.id, 'game_state_sync', {
            ...broadcastMessage,
            sender: player.name,
            room_id: room.id
          }).then(() => {
            console.log(`✅ [HOST-${player.name}] Game end message sent via InsForge`)
          }).catch((err) => {
            console.error('Error sending game end message:', err)
          })
        } catch (err) {
          console.error('Error in game end sync:', err)
        }
      }
    }
  }

  const isHost = player.is_host

  // Renderizar lobby
  if (roomState === 'lobby') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={onBack}
                  className="text-dominican-blue hover:text-dominican-blue-light"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">{room.name}</h1>
                  <p className="text-gray-600">Código: {room.code}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-600" />
                <span className="font-semibold text-gray-800">
                  {players.length}/{room.max_players}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8">
          {error && (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Lista de jugadores */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Jugadores en la Sala</h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {players.map((p) => (
                <div
                  key={p.id}
                  className={`p-4 rounded-lg border-2 ${
                    p.id === player.id 
                      ? 'border-dominican-blue bg-blue-50' 
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <PlayerAvatar avatar={p.avatar} size="md" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">{p.name}</span>
                        {p.is_host && <Crown className="w-4 h-4 text-yellow-500" />}
                      </div>
                      <p className="text-sm text-gray-600">
                        {p.id === player.id ? 'Tú' : 'Jugador'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Controles del host */}
          {isHost && (
            <div className="bg-gradient-to-r from-dominican-blue to-dominican-blue-light rounded-xl p-6 text-white">
              <h3 className="text-xl font-bold mb-4">Panel del Host</h3>
              <p className="mb-4">
                {players.length < 2 
                  ? 'Esperando más jugadores...' 
                  : `¡Listos para jugar! ${players.length} jugadores conectados`
                }
              </p>
              
              {room.status === 'waiting' && players.length >= 2 && (
                <button
                  onClick={handleStartGameSetup}
                  disabled={loading}
                  className="btn-dominican-secondary"
                >
                  <Play className="w-5 h-5 mr-2" />
                  {loading ? 'Iniciando...' : 'Iniciar Juego'}
                </button>
              )}
            </div>
          )}

          {/* Mensaje para jugadores no host */}
          {!isHost && (
            <div className="bg-white rounded-xl shadow-lg p-6 text-center">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Esperando al Host
              </h3>
              <p className="text-gray-600">
                El host iniciará el juego cuando esté listo
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Renderizar selector de juegos
  if (roomState === 'game-select') {
    return (
      <GameSelector
        games={games}
        onSelectGame={handleGameSelected}
        onBack={() => setRoomState('lobby')}
        title={`Selecciona un Juego para ${room.name}`}
      />
    )
  }

  // Debug: mostrar estado actual
  console.log('🎯 MultiplayerRoom Debug:', {
    roomState,
    gameState,
    currentGame: currentGame?.title || 'No game',
    currentQuestionIndex,
    hasQuestions: !!currentGame?.questions?.length,
    initialRoomGame: initialRoom.game?.title || 'No initial game',
    initialRoomGameQuestions: initialRoom.game?.questions?.length || 0
  })

  // Renderizar juego activo
  if (roomState === 'playing' && currentGame && gameState === 'question') {
    const currentQuestion = currentGame.questions?.[currentQuestionIndex]
    if (!currentQuestion) return null

    const progress = ((currentQuestionIndex + 1) / (currentGame.questions?.length || 1)) * 100

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header del juego */}
        <div className="bg-white shadow-sm">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-gray-800">{currentGame.title}</h1>
                <p className="text-gray-600">Sala: {room.name}</p>
              </div>
              
              <div className="flex items-center gap-6">
                {/* Temporizador */}
                <div className="relative flex items-center justify-center">
                  <svg
                    className={`w-16 h-16 ${
                      timeLeft <= 5 
                        ? 'timer-critical' 
                        : timeLeft <= 10 
                        ? 'timer-warning' 
                        : 'timer-normal transform -rotate-90'
                    }`}
                    viewBox="0 0 64 64"
                  >
                    <circle cx="32" cy="32" r="28" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                    <circle
                      cx="32" cy="32" r="28" fill="none"
                      stroke={timeLeft <= 5 ? '#dc2626' : timeLeft <= 10 ? '#f59e0b' : '#10b981'}
                      strokeWidth="4"
                      strokeDasharray={`${(timeLeft / currentQuestion.time_limit) * 175.929} 175.929`}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`font-bold text-lg ${
                      timeLeft <= 5 ? 'text-red-600' : timeLeft <= 10 ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      {selectedAnswer !== null ? '✓' : timeLeft}
                    </span>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600">
                  <div className="font-semibold">
                    Pregunta {currentQuestionIndex + 1} de {currentGame.questions?.length || 0}
                  </div>
                  <div className="text-xs">
                    {players.length} jugadores
                  </div>
                </div>
              </div>
            </div>
            
            {/* Barra de progreso */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-dominican-blue h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Pregunta */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="question-card">
            {currentQuestion.image_url && (
              <div className="mb-6">
                <img
                  src={currentQuestion.image_url}
                  alt="Imagen de la pregunta"
                  className="max-w-full h-64 object-cover rounded-lg mx-auto"
                />
              </div>
            )}
            
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              {currentQuestion.text}
            </h2>
            
            {/* Progreso de respuestas tipo Kahoot */}
            {(waitingForPlayers || showAnswer) && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                {waitingForPlayers ? (
                  <div>
                    <p className="text-blue-800 font-semibold">
                      Esperando respuestas...
                    </p>
                    <p className="text-blue-600 text-sm">
                      {Object.keys(playerAnswers).filter(id => playerAnswers[id] !== null).length} de {players.filter(p => p.id).length} jugadores han respondido
                    </p>
                  </div>
                ) : showAnswer && (
                  <p className="text-green-800 font-semibold">
                    ¡Todos los jugadores han respondido!
                  </p>
                )}
              </div>
            )}
            
            <div className="grid md:grid-cols-2 gap-4">
              {currentQuestion.options.map((option, index) => {
                // Obtener la respuesta del jugador actual (puede estar en selectedAnswer o en playerAnswers)
                const playerAnswer = selectedAnswer !== null ? selectedAnswer : playerAnswers[player.id]
                // Solo considerar como selección del jugador si realmente hay una respuesta válida
                // Importante: Verificar que playerAnswers[player.id] existe antes de usar su valor
                const hasLocalAnswer = selectedAnswer !== null
                const hasRemoteAnswer = player.id in playerAnswers && playerAnswers[player.id] !== null && playerAnswers[player.id] !== undefined
                const isPlayerChoice = (hasLocalAnswer || hasRemoteAnswer) && playerAnswer === index
                
                // Debug logging para identificar el problema en móvil
                if (index === 0 && isPlayerChoice && !hasLocalAnswer && !showAnswer) {
                  console.warn('🐛 DEBUG: Respuesta sombreada detectada en índice 0', {
                    selectedAnswer,
                    playerAnswersForThisPlayer: playerAnswers[player.id],
                    playerAnswers,
                    playerId: player.id,
                    hasLocalAnswer,
                    hasRemoteAnswer,
                    playerAnswer,
                    isPlayerChoice
                  })
                }
                const isCorrect = index === currentQuestion.correct_answer
                
                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={showAnswer}
                    className={`answer-option ${
                      showAnswer
                        ? isPlayerChoice && isCorrect
                          ? 'answer-option-correct'  // Respuesta del jugador Y es correcta
                          : isPlayerChoice
                          ? 'answer-option-incorrect' // Respuesta del jugador pero incorrecta
                          : ''
                        : isPlayerChoice
                        ? 'answer-option-selected'
                        : ''
                    }`}
                  >
                    <span>{option}</span>
                  </button>
                )
              })}
            </div>

            {showAnswer && (
              <div className="mt-8">
                {/* Resultado de la respuesta */}
                <div className="text-center mb-6">
                  {(() => {
                    // Obtener la respuesta del jugador actual de forma más robusta
                    const playerAnswer = selectedAnswer !== null ? selectedAnswer : playerAnswers[player.id]
                    const isCorrect = playerAnswer === currentQuestion.correct_answer
                    // Verificar que realmente existe una respuesta válida
                    const hasLocalAnswer = selectedAnswer !== null
                    const hasRemoteAnswer = player.id in playerAnswers && playerAnswers[player.id] !== null && playerAnswers[player.id] !== undefined
                    const hasAnswered = hasLocalAnswer || hasRemoteAnswer
                    
                    return (
                      <div className={`text-2xl font-bold mb-4 ${
                        isCorrect ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {isCorrect
                          ? '¡Correcto!' 
                          : hasTimedOut && !hasAnswered
                          ? '¡Tiempo Agotado!' 
                          : '¡Incorrecto!'
                        }
                      </div>
                    )
                  })()}
                </div>

                {/* Leaderboard parcial - Visible para TODOS los jugadores */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">
                    📊 Clasificación Actual
                  </h3>
                  <div className="space-y-2">
                    {players
                      .map(p => {
                        const playerResults = gameResults[p.id] || { correct: 0, total: 0, score: 0 }
                        return {
                          ...p,
                          score: playerResults.score,
                          correct: playerResults.correct
                        }
                      })
                      .sort((a, b) => b.score - a.score)
                      .map((p, index) => {
                        const isCurrentPlayer = p.id === player.id
                        return (
                          <div
                            key={p.id}
                            className={`flex items-center gap-3 p-3 rounded-lg ${
                              isCurrentPlayer 
                                ? 'bg-blue-100 border-2 border-blue-400' 
                                : index < 3 
                                ? 'bg-yellow-50 border border-yellow-200'
                                : 'bg-gray-50 border border-gray-200'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                              index === 0 ? 'bg-yellow-500 text-white' :
                              index === 1 ? 'bg-gray-400 text-white' :
                              index === 2 ? 'bg-orange-500 text-white' :
                              'bg-gray-300 text-gray-700'
                            }`}>
                              {index + 1}
                            </div>
                            <PlayerAvatar avatar={p.avatar} size="md" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-800">
                                {p.name}
                                {isCurrentPlayer && (
                                  <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                                    Tú
                                  </span>
                                )}
                              </h4>
                              <p className="text-xs text-gray-600">
                                {p.correct} correctas
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-gray-800">
                                {p.score}
                              </div>
                              <div className="text-xs text-gray-500">pts</div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
                
                {/* Controles del host para avanzar */}
                <div className="text-center">
                  {player.is_host ? (
                    <div className="space-y-4">
                      <div className="text-lg text-gray-600 mb-4">
                        Todos los jugadores han respondido
                      </div>
                      
                      {currentQuestionIndex + 1 < (currentGame?.questions?.length || 0) ? (
                        <button
                          onClick={handleNextQuestion}
                          className="btn-dominican-primary px-8 py-3 text-lg"
                        >
                          ▶️ Siguiente Pregunta ({currentQuestionIndex + 2} de {currentGame?.questions?.length})
                        </button>
                      ) : (
                        <button
                          onClick={handleNextQuestion}
                          className="btn-dominican-primary px-8 py-3 text-lg"
                        >
                          🏁 Ver Resultados Finales
                        </button>
                      )}
                      
                      <div className="text-sm text-gray-500">
                        Solo el host puede avanzar a la siguiente pregunta
                      </div>
                    </div>
                  ) : (
                    <div className="text-lg text-gray-600">
                      {currentQuestionIndex + 1 < (currentGame?.questions?.length || 0) 
                        ? 'Esperando que el host avance a la siguiente pregunta...'
                        : 'Esperando que el host muestre los resultados finales...'
                      }
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Renderizar resultados
  if (roomState === 'results') {
    // Calcular leaderboard basado en gameResults
    const leaderboard = players
      .map(p => {
        const playerResults = gameResults[p.id] || { correct: 0, total: 0, score: 0 }
        const accuracy = playerResults.total > 0 ? Math.round((playerResults.correct / playerResults.total) * 100) : 0
        
        return {
          ...p,
          finalScore: playerResults.score,
          correctAnswers: playerResults.correct,
          totalQuestions: playerResults.total,
          accuracy: accuracy,
          rank: 0
        }
      })
      .sort((a, b) => {
        // Ordenar por puntuación, luego por precisión, luego por nombre
        if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore
        if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy
        return a.name.localeCompare(b.name)
      })
      .map((p, index) => ({ ...p, rank: index + 1 }))

    const currentPlayerRank = leaderboard.find(p => p.id === player.id)?.rank || 0

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
                <h1 className="text-2xl font-bold text-gray-800">Resultados Finales</h1>
                <p className="text-gray-600">{room.name} - {currentGame?.title}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Podio de ganadores */}
          {leaderboard.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">¡Juego Terminado!</h2>
                <p className="text-gray-600">Felicitaciones a todos los participantes</p>
              </div>

              {/* Top 3 */}
              <div className="flex justify-center items-end gap-8 mb-8">
                {/* Segundo lugar */}
                {leaderboard[1] && (
                  <div className="text-center">
                    <div className="mb-3">
                      <PlayerAvatar avatar={leaderboard[1].avatar} size="lg" />
                    </div>
                    <div className="bg-gray-100 rounded-lg px-4 py-6">
                      <div className="text-2xl font-bold text-gray-600 mb-1">2°</div>
                      <div className="font-semibold text-gray-800">{leaderboard[1].name}</div>
                      <div className="text-lg text-gray-600">{leaderboard[1].finalScore} pts</div>
                      <div className="text-sm text-gray-500">{leaderboard[1].accuracy}% precisión</div>
                    </div>
                  </div>
                )}

                {/* Primer lugar */}
                {leaderboard[0] && (
                  <div className="text-center">
                    <div className="mb-3 ring-4 ring-yellow-400 rounded-full inline-block">
                      <PlayerAvatar avatar={leaderboard[0].avatar} size="xl" />
                    </div>
                    <div className="bg-gradient-to-b from-yellow-100 to-yellow-200 rounded-lg px-6 py-8">
                      <Crown className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-yellow-600 mb-1">1°</div>
                      <div className="font-bold text-gray-800">{leaderboard[0].name}</div>
                      <div className="text-xl text-yellow-700">{leaderboard[0].finalScore} pts</div>
                      <div className="text-sm text-yellow-600">{leaderboard[0].accuracy}% precisión</div>
                    </div>
                  </div>
                )}

                {/* Tercer lugar */}
                {leaderboard[2] && (
                  <div className="text-center">
                    <div className="mb-3">
                      <PlayerAvatar avatar={leaderboard[2].avatar} size="lg" />
                    </div>
                    <div className="bg-orange-100 rounded-lg px-4 py-6">
                      <div className="text-2xl font-bold text-orange-600 mb-1">3°</div>
                      <div className="font-semibold text-gray-800">{leaderboard[2].name}</div>
                      <div className="text-lg text-orange-600">{leaderboard[2].finalScore} pts</div>
                      <div className="text-sm text-orange-500">{leaderboard[2].accuracy}% precisión</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tu posición */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-center">
                <p className="text-blue-800 font-semibold">
                  Tu posición: #{currentPlayerRank} de {leaderboard.length} jugadores
                </p>
              </div>
            </div>
          )}

          {/* Tabla completa */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <h3 className="text-xl font-bold">Clasificación Final</h3>
              <p className="text-purple-100">Todos los participantes</p>
            </div>

            <div className="p-6 space-y-3">
              {leaderboard.map((p, index) => {
                const isCurrentPlayer = p.id === player.id
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                      isCurrentPlayer 
                        ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-200' 
                        : index < 3 
                        ? 'border-yellow-200 bg-yellow-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        index === 0 ? 'bg-yellow-500 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-orange-500 text-white' :
                        'bg-gray-200 text-gray-700'
                      }`}>
                        {p.rank}
                      </div>
                      <PlayerAvatar avatar={p.avatar} size="md" />
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">
                        {p.name}
                        {isCurrentPlayer && (
                          <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
                            Tú
                          </span>
                        )}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {p.correctAnswers}/{p.totalQuestions} correctas ({p.accuracy}%)
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-800">
                        {p.finalScore}
                      </div>
                      <div className="text-xs text-gray-500">puntos</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Acciones finales */}
          <div className="mt-8 flex gap-4 justify-center">
            <button
              onClick={onBack}
              className="btn-dominican-primary px-8 py-3"
            >
              Volver al Inicio
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Renderizado por defecto para debugging
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Debug Info</h2>
        <div className="space-y-2 text-sm">
          <p><strong>Room State:</strong> {roomState}</p>
          <p><strong>Game State:</strong> {gameState}</p>
          <p><strong>Current Game:</strong> {currentGame?.title || 'No game selected'}</p>
          <p><strong>Has Questions:</strong> {currentGame?.questions?.length || 0} questions</p>
          <p><strong>Current Question Index:</strong> {currentQuestionIndex}</p>
          <p><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</p>
          {error && <p className="text-red-600"><strong>Error:</strong> {error}</p>}
        </div>
        <button onClick={onBack} className="btn-dominican-primary mt-4 w-full">
          Volver al Inicio
        </button>
      </div>
    </div>
  )
}

export default MultiplayerRoom