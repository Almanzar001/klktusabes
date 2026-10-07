import { createClient } from '@insforge/sdk'

// Configuración de InsForge
const insforgeUrl = (import.meta as any).env.VITE_INSFORGE_URL
const insforgeAnonKey = (import.meta as any).env.VITE_INSFORGE_ANON_KEY

if (!insforgeUrl || !insforgeAnonKey) {
  throw new Error('Variables de entorno de InsForge no encontradas. Por favor configura VITE_INSFORGE_URL y VITE_INSFORGE_ANON_KEY')
}

// Crear cliente de InsForge
export const insforge = createClient({
  baseUrl: insforgeUrl,
  anonKey: insforgeAnonKey
})

const db = insforge.database

// Funciones auxiliares para trabajar con la base de datos


// Funciones de autenticación
export const authHelpers = {
  // Iniciar sesión con Google
  signInWithGoogle: async () => {
    const { data, error } = await insforge.auth.signInWithOAuth('google', {
      redirectTo: `${window.location.origin}`
    })
    return { data, error }
  },

  // Registrarse con email y contraseña
  signUpWithEmail: async (email: string, password: string, fullName: string) => {
    const { data, error } = await insforge.auth.signUp({
      email,
      password,
      name: fullName
    })
    return { data, error }
  },

  // Verificar el correo con el código de 6 dígitos (deja la sesión iniciada)
  verifyEmail: async (email: string, code: string) => {
    const { data, error } = await insforge.auth.verifyEmail({ email, otp: code })
    return { data, error }
  },

  // Reenviar el código de verificación
  resendVerificationEmail: async (email: string) => {
    const { data, error } = await insforge.auth.resendVerificationEmail({ email })
    return { data, error }
  },

  // Iniciar sesión con email y contraseña
  signInWithEmail: async (email: string, password: string) => {
    const { data, error } = await insforge.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  // Restablecer contraseña (envía un código de 6 dígitos al correo)
  resetPassword: async (email: string) => {
    const { data, error } = await insforge.auth.sendResetPasswordEmail({ email })
    return { data, error }
  },

  // Cambiar la contraseña con el código recibido por correo
  confirmPasswordReset: async (email: string, code: string, newPassword: string) => {
    const { data: exchange, error: exchangeError } = await insforge.auth.exchangeResetPasswordToken({ email, code })
    if (exchangeError || !exchange) {
      return { data: null, error: exchangeError }
    }

    const { data, error } = await insforge.auth.resetPassword({
      newPassword,
      otp: exchange.token
    })
    return { data, error }
  },

  // Cerrar sesión
  signOut: async () => {
    const { error } = await insforge.auth.signOut()
    return { error }
  },

  // Obtener usuario actual
  getCurrentUser: async () => {
    const { data, error } = await insforge.auth.getCurrentUser()
    return { user: data?.user ?? null, error }
  },

  // Obtener perfil del usuario
  getUserProfile: async (userId: string) => {
    const { data, error } = await db
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    return { data, error }
  }
}

// Funciones para juegos
export const gameHelpers = {
  // Obtener todos los juegos con sus preguntas
  getAllGames: async () => {
    try {
      const { data, error } = await db
        .from('games')
        .select('*, questions(*)')
        .order('created_at', { ascending: false })
        .order('order_number', { referencedTable: 'questions', ascending: true })

      if (error) {
        return { data: null, error: { message: `Error al obtener juegos: ${error.message}` } }
      }

      return { data, error: null }

    } catch (error) {
      console.error('Error in getAllGames:', error)
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Error desconocido al cargar juegos'
        }
      }
    }
  },

  // Obtener un juego específico con sus preguntas
  getGameWithQuestions: async (gameId: string) => {
    try {
      const { data: game, error } = await db
        .from('games')
        .select('*, questions(*)')
        .eq('id', gameId)
        .order('order_number', { referencedTable: 'questions', ascending: true })
        .maybeSingle()

      if (error) {
        return { data: null, error: { message: 'Error al obtener el juego' } }
      }

      if (!game) {
        return { data: null, error: { message: 'Juego no encontrado' } }
      }

      return { data: game, error: null }

    } catch (error) {
      console.error('Error in getGameWithQuestions:', error)
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Error desconocido'
        }
      }
    }
  },

  // Crear un nuevo juego
  createGame: async (title: string, description: string, userId: string) => {
    const { data, error } = await db
      .from('games')
      .insert([
        {
          title,
          description,
          created_by_user: userId
        }
      ])
      .select()
      .single()
    return { data, error }
  },

  // Actualizar un juego existente
  updateGame: async (gameId: string, gameData: { title?: string; description?: string }) => {
    try {
      const { data, error } = await db
        .from('games')
        .update(gameData)
        .eq('id', gameId)
        .select()

      if (error) {
        return { data: null, error }
      }

      return { data: data?.[0], error: null }

    } catch (error) {
      console.error('Error in updateGame:', error)
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Error desconocido al actualizar juego',
          originalError: error
        }
      }
    }
  },

  // Eliminar un juego
  deleteGame: async (gameId: string) => {
    try {
      const { error } = await db
        .from('games')
        .delete()
        .eq('id', gameId)

      if (error) {
        return { data: null, error }
      }

      return { data: { success: true }, error: null }

    } catch (error) {
      console.error('Error in deleteGame:', error)
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Error desconocido al eliminar juego',
          originalError: error
        }
      }
    }
  },

  // Agregar pregunta a un juego
  addQuestion: async (gameId: string, questionData: any) => {
    try {
      const insertData = {
        game_id: gameId,
        ...questionData
      }

      const { data, error } = await db
        .from('questions')
        .insert([insertData])
        .select()

      if (error) {
        return { data: null, error }
      }

      return { data: data?.[0], error: null }

    } catch (error) {
      console.error('Error in addQuestion:', error)
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Error desconocido al agregar pregunta',
          originalError: error
        }
      }
    }
  },

  // Versión directa de addQuestion (se mantiene por compatibilidad)
  addQuestionDirect: async (gameId: string, questionData: any) => {
    try {
      const insertData = {
        game_id: gameId,
        ...questionData
      }

      const { data, error } = await db
        .from('questions')
        .insert([insertData])
        .select()

      if (error) {
        return { data: null, error }
      }

      return { data: data?.[0], error: null }

    } catch (error) {
      console.error('Error in addQuestionDirect:', error)
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Error desconocido al agregar pregunta',
          originalError: error
        }
      }
    }
  },

  // Actualizar pregunta existente
  updateQuestion: async (questionId: string, questionData: any) => {
    try {
      const { data, error } = await db
        .from('questions')
        .update(questionData)
        .eq('id', questionId)
        .select()

      if (error) {
        return { data: null, error }
      }

      return { data: data?.[0], error: null }

    } catch (error) {
      console.error('Error in updateQuestion:', error)
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Error desconocido al actualizar pregunta',
          originalError: error
        }
      }
    }
  },

  // Eliminar pregunta
  deleteQuestion: async (questionId: string) => {
    try {
      const { error } = await db
        .from('questions')
        .delete()
        .eq('id', questionId)

      if (error) {
        return { data: null, error }
      }

      return { data: { success: true }, error: null }

    } catch (error) {
      console.error('Error in deleteQuestion:', error)
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Error desconocido al eliminar pregunta',
          originalError: error
        }
      }
    }
  }
}

// Funciones para estadísticas
export const statsHelpers = {
  // Obtener estadísticas generales de la aplicación
  getAppStatistics: async () => {
    try {
      // Obtener estadísticas en paralelo
      const [gamesResult, creatorsResult, sessionsResult] = await Promise.all([
        // Total de juegos
        db.from('games').select('id'),

        // Usuarios creadores (con role 'creador' en user_profiles)
        db.from('user_profiles').select('id').eq('role', 'creador'),

        // Total de sesiones QR activas
        db.from('qr_game_sessions').select('id').eq('is_active', true)
      ])

      const gamesData = gamesResult.data ?? []
      const creatorsData = creatorsResult.data ?? []
      const sessionsData = sessionsResult.data ?? []

      // Calcular jugadores activos de manera más realista y conservadora
      const activeCreators = creatorsData.length || 0
      const totalGames = gamesData.length || 0
      const activeSessions = sessionsData.length || 0

      // Estimación conservadora:
      // - Creadores activos (los que realmente están creando)
      // - Más 2-4 jugadores promedio por juego disponible
      // - Más jugadores en sesiones QR activas
      const baseActivePlayers = activeCreators
      const playersFromGames = totalGames * 3 // 3 jugadores promedio por juego
      const playersFromSessions = activeSessions * 2 // 2 jugadores promedio por sesión QR

      const estimatedActivePlayers = baseActivePlayers + playersFromGames + playersFromSessions

      // Partidas jugadas: estimación más realista
      // Basado en: juegos disponibles * factor de uso moderado
      const estimatedMatches = (totalGames * 12) + (activeCreators * 8) + (activeSessions * 5)

      const stats = {
        totalGames: totalGames,
        activeUsers: Math.min(estimatedActivePlayers, 85), // Máximo más realista de 85
        activeSessions: activeSessions,
        totalMatches: Math.max(estimatedMatches, 0)
      }

      return { data: stats, error: null }

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error)
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Error desconocido al obtener estadísticas'
        }
      }
    }
  },

  // Obtener estadísticas específicas de un usuario (para admin panel)
  getUserStatistics: async (userId: string) => {
    try {
      // Obtener estadísticas del usuario en paralelo
      const [gamesResult, qrSessionsResult] = await Promise.all([
        // Juegos creados por el usuario
        db.from('games').select('id,title,created_at,questions(count)').eq('created_by_user', userId),

        // Sesiones QR creadas por el usuario
        db.from('qr_game_sessions').select('id').eq('created_by_user', userId).eq('is_active', true)
      ])

      const gamesData: any = gamesResult.data ?? []
      const qrSessionsData = qrSessionsResult.data ?? []

      // Calcular estadísticas realistas para el usuario específico
      const userGamesCount = gamesData.length || 0
      const userQRSessions = qrSessionsData.length || 0

      // Jugadores activos: estimación conservadora basada en actividad real del usuario
      let estimatedActivePlayers
      if (userGamesCount > 0) {
        // Si tiene juegos: 4-8 jugadores promedio por juego
        estimatedActivePlayers = userGamesCount * 6 + userQRSessions * 3
      } else {
        // Si no tiene juegos: entre 0-5 jugadores potenciales
        estimatedActivePlayers = userQRSessions * 2
      }

      // Partidas jugadas: basado en juegos y sesiones reales
      const estimatedMatches = (userGamesCount * 8) + (userQRSessions * 5) + 3

      const stats = {
        gamesCreated: gamesData.length || 0,
        qrSessions: qrSessionsData.length || 0,
        activePlayers: estimatedActivePlayers,
        totalMatches: estimatedMatches,
        recentGames: gamesData.slice(0, 3).map((game: any) => ({
          id: game.id,
          title: game.title,
          questions: Math.floor(Math.random() * 20) + 5, // Simulado por ahora
          plays: Math.floor(Math.random() * 100) + 10,
          created: formatRelativeTime(game.created_at)
        }))
      }

      return { data: stats, error: null }

    } catch (error) {
      console.error('Error obteniendo estadísticas de usuario:', error)
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Error desconocido al obtener estadísticas de usuario'
        }
      }
    }
  }
}

// Función auxiliar para formatear tiempo relativo
const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 1) return '1 día'
  if (diffDays < 7) return `${diffDays} días`
  if (diffDays < 14) return '1 semana'
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas`
  return `${Math.floor(diffDays / 30)} meses`
}

// Funciones para salas multijugador
export const roomHelpers = {
  // Crear una nueva sala
  createRoom: async (name: string, code: string, userId: string, maxPlayers: number = 20) => {
    const { data, error } = await db
      .from('rooms')
      .insert([
        {
          name,
          code,
          created_by_user: userId,
          status: 'waiting',
          max_players: maxPlayers
        }
      ])
      .select()
      .single()
    return { data, error }
  },

  // Buscar sala por código
  findRoomByCode: async (code: string) => {
    try {
      console.log('🔍 Searching for room with code:', code)

      // Primero obtener la sala básica
      const { data: roomData, error: roomError } = await db
        .from('rooms')
        .select('*')
        .eq('code', code)
        .single()

      if (roomError) {
        console.log('❌ Room query error:', roomError)
        return { data: null, error: roomError }
      }

      if (!roomData) {
        console.log('❌ No room found with code:', code)
        return { data: null, error: { message: 'Room not found', code: 'ROOM_NOT_FOUND' } }
      }

      console.log('✅ Room found:', roomData)

      // Luego obtener los jugadores de la sala
      const { data: playersData, error: playersError } = await db
        .from('players')
        .select('*')
        .eq('room_id', roomData.id)
        .order('joined_at', { ascending: true })

      if (playersError) {
        console.log('⚠️ Players query error:', playersError)
        // Continuar sin jugadores si hay error
      }

      // Combinar los datos
      const completeRoomData = {
        ...roomData,
        players: playersData || []
      }

      console.log('✅ Complete room data:', completeRoomData)
      return { data: completeRoomData, error: null }

    } catch (err) {
      console.error('💥 Unexpected error in findRoomByCode:', err)
      return {
        data: null,
        error: {
          message: 'Error inesperado al buscar la sala',
          originalError: err
        }
      }
    }
  },

  // Unirse a una sala como jugador
  joinRoom: async (roomId: string, playerName: string, avatar: string, isHost = false) => {
    try {
      console.log('🎮 Attempting to join room:', { roomId, playerName, avatar, isHost })

      const playerData = {
        room_id: roomId,
        name: playerName,
        avatar,
        is_host: isHost,
        score: 0
      }

      const { data, error } = await db
        .from('players')
        .insert([playerData])
        .select()
        .single()

      if (error) {
        console.error('❌ Join room error:', error)

        // Mejorar mensajes de error específicos
        if (error.code === '23505') {
          return {
            data: null,
            error: {
              ...error,
              message: 'Ya existe un jugador con ese nombre en la sala'
            }
          }
        }

        if (error.message?.includes('violates check constraint')) {
          return {
            data: null,
            error: {
              ...error,
              message: 'Datos del jugador no válidos'
            }
          }
        }
      } else {
        console.log('✅ Successfully joined room:', data)
      }

      return { data, error }
    } catch (err) {
      console.error('💥 Unexpected error in joinRoom:', err)
      return {
        data: null,
        error: {
          message: 'Error inesperado al unirse a la sala',
          originalError: err
        }
      }
    }
  },

  // Obtener jugadores de una sala
  getRoomPlayers: async (roomId: string) => {
    const { data, error } = await db
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true })
    return { data, error }
  },

  // Actualizar estado de la sala
  updateRoomStatus: async (roomId: string, status: string) => {
    const { data, error } = await db
      .from('rooms')
      .update({ status })
      .eq('id', roomId)
      .select()
      .single()
    return { data, error }
  },

  // Obtener el estado actual de la sala
  getRoom: async (roomId: string) => {
    const { data, error } = await db
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle()
    return { data, error }
  },

  // Sesión de juego de la sala junto con el juego y sus preguntas en orden
  getRoomGame: async (roomId: string) => {
    const { data: session, error: sessionError } = await db
      .from('game_sessions')
      .select('id, game_id')
      .eq('room_id', roomId)
      .maybeSingle()

    if (sessionError || !session) {
      return { data: null, error: sessionError }
    }

    const { data: game, error: gameError } = await gameHelpers.getGameWithQuestions(session.game_id)

    if (gameError || !game) {
      return { data: null, error: gameError }
    }

    return { data: { sessionId: session.id as string, game }, error: null }
  },

  // Control de la partida. La fila de rooms es la única fuente de verdad y cada
  // cambio va condicionado al estado anterior: repetirlo, o lanzarlo desde dos
  // dispositivos a la vez, no avanza la partida dos veces.

  // Sala de espera → primera pregunta
  startGame: async (roomId: string) => {
    const { data, error } = await db
      .from('rooms')
      .update({ status: 'playing', current_question_index: 0 })
      .eq('id', roomId)
      .eq('status', 'waiting')
      .select()
    return { data: data?.[0] ?? null, error }
  },

  // Pregunta abierta → respuesta correcta y marcador
  revealAnswer: async (roomId: string, questionIndex: number) => {
    const { data, error } = await db
      .from('rooms')
      .update({ status: 'show_results' })
      .eq('id', roomId)
      .eq('status', 'playing')
      .eq('current_question_index', questionIndex)
      .select()
    return { data: data?.[0] ?? null, error }
  },

  // Marcador → siguiente pregunta
  goToNextQuestion: async (roomId: string, questionIndex: number) => {
    const { data, error } = await db
      .from('rooms')
      .update({ status: 'playing', current_question_index: questionIndex + 1 })
      .eq('id', roomId)
      .eq('status', 'show_results')
      .eq('current_question_index', questionIndex)
      .select()
    return { data: data?.[0] ?? null, error }
  },

  // Marcador de la última pregunta → podio
  finishGame: async (roomId: string) => {
    const { data, error } = await db
      .from('rooms')
      .update({ status: 'finished' })
      .eq('id', roomId)
      .eq('status', 'show_results')
      .select()
    return { data: data?.[0] ?? null, error }
  },

  // Actualizar sala con estado y juego
  updateRoomWithGame: async (roomId: string, status: string, game: any) => {
    console.log('🎯 Updating room with game:', { roomId, status, gameTitle: game?.title, gameQuestions: game?.questions?.length })

    const { data, error } = await db
      .from('rooms')
      .update({
        status,
        current_game_data: game // Almacenar el juego completo
      })
      .eq('id', roomId)
      .select()
      .single()

    if (error) {
      console.error('❌ Error updating room with game:', error)
    } else {
      console.log('✅ Room updated with game successfully')
    }

    return { data, error }
  },

  // Actualizar puntuación de jugador
  updatePlayerScore: async (playerId: string, score: number) => {
    const { data, error } = await db
      .from('players')
      .update({ score })
      .eq('id', playerId)
      .select()
      .single()
    return { data, error }
  },

  // Crear sesión de juego para una sala
  createGameSession: async (roomId: string, gameId: string) => {
    try {
      console.log('🎮 Creating game session for room:', roomId, 'with game:', gameId)

      const sessionData = {
        room_id: roomId,
        game_id: gameId,
        current_question: 0
      }

      const { data, error } = await db
        .from('game_sessions')
        .insert([sessionData])
        .select()
        .single()

      if (error) {
        console.error('❌ Error creating game session:', error)
      } else {
        console.log('✅ Game session created successfully:', data)
      }

      return { data, error }
    } catch (err) {
      console.error('💥 Unexpected error in createGameSession:', err)
      return {
        data: null,
        error: {
          message: 'Error inesperado al crear sesión de juego',
          originalError: err
        }
      }
    }
  },

  // Crear sesión de juego con datos completos del juego
  createGameSessionWithFullGame: async (roomId: string, gameId: string, fullGameData: any) => {
    try {
      console.log('🎯 Creating game session with full game data:', fullGameData?.title, 'Questions:', fullGameData?.questions?.length)

      const sessionData = {
        room_id: roomId,
        game_id: gameId,
        current_question: 0,
        game_data: fullGameData // Almacenar el juego completo
      }

      const { data, error } = await db
        .from('game_sessions')
        .insert([sessionData])
        .select()
        .single()

      if (error) {
        console.error('❌ Error creating game session with full data:', error)
      } else {
        console.log('✅ Game session with full data created successfully:', data)
      }

      return { data, error }
    } catch (err) {
      console.error('💥 Unexpected error in createGameSessionWithFullGame:', err)
      return {
        data: null,
        error: {
          message: 'Error inesperado al crear sesión de juego completa',
          originalError: err
        }
      }
    }
  },

  // Obtener sesión de juego activa de una sala
  getRoomGameSession: async (roomId: string) => {
    try {
      console.log('🔍 Getting game session for room:', roomId)

      // Primero obtener la sesión básica
      const { data: sessionData, error: sessionError } = await db
        .from('game_sessions')
        .select('*')
        .eq('room_id', roomId)
        .single()

      if (sessionError) {
        console.error('❌ Error getting game session:', sessionError)
        return { data: null, error: sessionError }
      }

      if (!sessionData) {
        console.log('❌ No game session found for room:', roomId)
        return {
          data: null,
          error: {
            message: 'No se encontró sesión de juego para esta sala',
            code: 'SESSION_NOT_FOUND'
          }
        }
      }

      console.log('✅ Game session found:', sessionData)

      // Luego obtener los datos del juego por separado
      const { data: gameData, error: gameError } = await db
        .from('games')
        .select('*')
        .eq('id', sessionData.game_id)
        .single()

      if (gameError) {
        console.log('⚠️ Game data query error:', gameError)
        // Continuar sin datos de juego si hay error
      }

      // Combinar los datos
      const completeSessionData = {
        ...sessionData,
        games: gameData
      }

      console.log('✅ Complete session data:', completeSessionData)
      return { data: completeSessionData, error: null }

    } catch (err) {
      console.error('💥 Unexpected error in getRoomGameSession:', err)
      return {
        data: null,
        error: {
          message: 'Error inesperado al obtener sesión de juego',
          originalError: err
        }
      }
    }
  }
}

// Funciones para sesiones QR
export const qrHelpers = {
  // Crear sesión QR
  createQRSession: async (accessCode: string, gameId: string, title: string, description: string, userId: string, maxParticipants: number = 50, activeTimeHours: number = 24) => {
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + activeTimeHours)

    const { data, error } = await db
      .from('qr_game_sessions')
      .insert([
        {
          access_code: accessCode,
          game_id: gameId,
          title,
          description,
          created_by_user: userId,
          max_participants: maxParticipants,
          expires_at: expiresAt.toISOString(),
          is_active: true
        }
      ])
      .select()
      .single()
    return { data, error }
  },

  // Buscar sesión QR por código
  findQRSession: async (accessCode: string) => {
    const { data, error } = await db
      .from('qr_game_sessions')
      .select(`
        *,
        games (
          *,
          questions (*)
        )
      `)
      .eq('access_code', accessCode)
      .eq('is_active', true)
      .single()
    return { data, error }
  },

  // Obtener todas las sesiones QR de un usuario
  getUserQRSessions: async (userId: string) => {
    const { data, error } = await db
      .from('qr_game_sessions')
      .select(`
        *,
        games (*)
      `)
      .eq('created_by_user', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    return { data, error }
  },

  // Desactivar sesión QR
  deactivateQRSession: async (sessionId: string) => {
    const { data, error } = await db
      .from('qr_game_sessions')
      .update({ is_active: false })
      .eq('id', sessionId)
      .select()
      .single()
    return { data, error }
  }
}

// Funciones para respuestas y sesiones de juego
export const sessionHelpers = {

  // Registrar respuesta de jugador
  recordPlayerAnswer: async (playerId: string, questionId: string, sessionId: string, answer: number, timeToAnswer: number, isCorrect: boolean, pointsEarned: number) => {
    const { data, error } = await db
      .from('player_answers')
      .insert([
        {
          player_id: playerId,
          question_id: questionId,
          session_id: sessionId,
          answer,
          time_to_answer: timeToAnswer,
          is_correct: isCorrect,
          points_earned: pointsEarned
        }
      ])
      .select()
      .single()
    return { data, error }
  },

  // Enviar la respuesta de un jugador. Solo viaja la opción elegida: el servidor
  // mide el tiempo, decide si es correcta y calcula los puntos.
  submitAnswer: async (sessionId: string, playerId: string, questionId: string, answer: number) => {
    const { data, error } = await db
      .from('player_answers')
      .insert([
        {
          session_id: sessionId,
          player_id: playerId,
          question_id: questionId,
          answer,
          // valores provisionales; el trigger score_player_answer los sobrescribe
          time_to_answer: 1,
          is_correct: false
        }
      ])
      .select()
      .single()
    return { data, error }
  },

  // Respuestas recibidas para una pregunta
  getQuestionAnswers: async (sessionId: string, questionId: string) => {
    const { data, error } = await db
      .from('player_answers')
      .select('player_id, answer, is_correct, points_earned, time_to_answer')
      .eq('session_id', sessionId)
      .eq('question_id', questionId)
    return { data, error }
  },

  // Diferencia entre el reloj del servidor y el de este dispositivo (ms)
  getServerTimeOffset: async () => {
    const sentAt = Date.now()
    const { data, error } = await db.rpc('server_now')
    const receivedAt = Date.now()
    if (error || !data) return 0
    return new Date(data as string).getTime() - (sentAt + receivedAt) / 2
  },

  // Avanzar a siguiente pregunta
  nextQuestion: async (sessionId: string, currentQuestion: number) => {
    const { data, error } = await db
      .from('game_sessions')
      .update({ current_question: currentQuestion + 1 })
      .eq('id', sessionId)
      .select()
      .single()
    return { data, error }
  }
}

// Suscripciones en tiempo real
//
// En InsForge los cambios de tablas llegan por canales: los triggers de la base
// de datos publican en `room:<id>` (players, rooms, game_sessions) y en
// `session:<id>` (player_answers) con la forma { eventType, new, old }. El
// estado de la partida viaja en la fila de rooms (evento room_changed).
export interface RealtimeSubscription {
  unsubscribe: () => void
}

// Varias suscripciones comparten canal; solo se abandona cuando no queda ninguna
const channelUsers = new Map<string, number>()

const roomChannel = (roomId: string) => `room:${roomId}`

const joinChannel = (channel: string) => {
  channelUsers.set(channel, (channelUsers.get(channel) ?? 0) + 1)
  insforge.realtime.subscribe(channel)
    .then((response) => {
      if (!response.ok && response.error.code !== 'SUBSCRIPTION_CANCELLED') {
        console.error(`Error al suscribirse al canal ${channel}:`, response.error)
      }
    })
    .catch((err) => console.error(`Error al suscribirse al canal ${channel}:`, err))
}

const leaveChannel = (channel: string) => {
  const users = (channelUsers.get(channel) ?? 0) - 1
  if (users > 0) {
    channelUsers.set(channel, users)
    return
  }
  channelUsers.delete(channel)
  insforge.realtime.unsubscribe(channel)
}

const listen = (channel: string, event: string, callback: (payload: any) => void): RealtimeSubscription => {
  const handler = (message: any) => {
    // El servidor entrega el nombre del canal con el prefijo `realtime:`
    const source = message?.meta?.channel
    if (source !== channel && source !== `realtime:${channel}`) return
    callback(message)
  }

  insforge.realtime.on(event, handler)
  joinChannel(channel)

  return {
    unsubscribe: () => {
      insforge.realtime.off(event, handler)
      leaveChannel(channel)
    }
  }
}

export const realtimeHelpers = {
  // Suscribirse a cambios en jugadores de una sala
  subscribeToRoomPlayers: (roomId: string, callback: (payload: any) => void) => {
    return listen(roomChannel(roomId), 'players_changed', callback)
  },

  // Suscribirse a cambios en una sala
  subscribeToRoom: (roomId: string, callback: (payload: any) => void) => {
    return listen(roomChannel(roomId), 'room_changed', callback)
  },

  // Suscribirse a respuestas de una sesión
  subscribeToSessionAnswers: (sessionId: string, callback: (payload: any) => void) => {
    return listen(`session:${sessionId}`, 'answers_changed', callback)
  },

  // Suscribirse a cambios en sesiones de juego
  subscribeToGameSession: (roomId: string, callback: (payload: any) => void) => {
    return listen(roomChannel(roomId), 'game_session_changed', callback)
  },

  // Avisar cuando la conexión en tiempo real se (re)establece, para volver a
  // leer el estado: los eventos emitidos durante un corte no se reenvían.
  onReconnect: (callback: () => void): RealtimeSubscription => {
    insforge.realtime.on('connect', callback)
    return {
      unsubscribe: () => insforge.realtime.off('connect', callback)
    }
  },

  // Desuscribirse de un canal
  unsubscribe: (subscription: RealtimeSubscription) => {
    subscription.unsubscribe()
  }
}

// Funciones para resultados de sesiones QR
export const qrResultsHelpers = {
  // Guardar resultado de jugador en sesión QR (con UPSERT para evitar duplicados)
  saveQRSessionResult: async (qrSessionId: string, playerName: string, totalScore: number, totalCorrect: number, totalQuestions: number, avgTime: number, gameData: any) => {
    // Usar upsert para actualizar si ya existe o insertar si no
    const { data, error } = await db
      .from('qr_session_results')
      .upsert(
        {
          qr_session_id: qrSessionId,
          player_name: playerName.trim(), // Normalizar nombre
          total_score: totalScore,
          total_correct: totalCorrect,
          total_questions: totalQuestions,
          avg_time: avgTime,
          game_data: gameData,
          completed_at: new Date().toISOString()
        },
        {
          onConflict: 'qr_session_id,player_name', // Especificar qué campos usar para detectar conflictos
          ignoreDuplicates: false // Actualizar en caso de conflicto
        }
      )
      .select()
      .single()
    return { data, error }
  },

  // Obtener leaderboard de una sesión QR
  getQRSessionLeaderboard: async (qrSessionId: string) => {
    const { data, error } = await db
      .from('qr_session_results')
      .select('*')
      .eq('qr_session_id', qrSessionId)
      .order('total_score', { ascending: false })
      .order('avg_time', { ascending: true })
      .limit(10)
    return { data, error }
  },

  // Verificar si un jugador ya jugó esta sesión
  checkPlayerPlayed: async (qrSessionId: string, playerName: string) => {
    const { data, error } = await db
      .from('qr_session_results')
      .select('id, total_score, completed_at')
      .eq('qr_session_id', qrSessionId)
      .eq('player_name', playerName)
      .order('completed_at', { ascending: false })
      .limit(1)
    return { data, error }
  },

  // Obtener estadísticas de la sesión
  getQRSessionStats: async (qrSessionId: string) => {
    const { data, error } = await db
      .from('qr_session_results')
      .select('total_score, total_correct, total_questions')
      .eq('qr_session_id', qrSessionId)

    if (error) return { data: null, error }

    const stats = {
      total_players: data.length,
      avg_score: data.length > 0 ? Math.round(data.reduce((acc, r) => acc + r.total_score, 0) / data.length) : 0,
      best_score: data.length > 0 ? Math.max(...data.map(r => r.total_score)) : 0,
      avg_accuracy: data.length > 0 ? Math.round((data.reduce((acc, r) => acc + (r.total_correct / r.total_questions), 0) / data.length) * 100) : 0
    }

    return { data: stats, error: null }
  }
}

export default insforge
