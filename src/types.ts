// Tipos para la aplicación KLKTUSABES

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  role: 'participante' | 'creador'
  created_at: string
  updated_at: string
}

export interface Game {
  id: string
  title: string
  description?: string
  created_at: string
  updated_at: string
  created_by_user?: string
  // La app lee en voz alta las preguntas y respuestas (para niños que aún no leen)
  read_aloud?: boolean
  questions?: Question[]
}

// Imagen de una respuesta: la URL la muestra y la clave permite borrarla
export interface OptionImage {
  url: string
  key: string | null
}

export interface Question {
  id: string
  game_id: string
  text: string
  options: string[] // Array de 4 opciones; el texto puede ir vacío si la respuesta tiene imagen
  // Una entrada por respuesta, en el orden de `options`; null si es solo texto
  option_images?: Array<OptionImage | null> | null
  correct_answer: number // Índice de la respuesta correcta (0-3)
  time_limit: number
  order_number: number
  // Imagen y sonido opcionales: la URL los muestra y la clave permite borrarlos
  image_url?: string | null
  image_key?: string | null
  audio_url?: string | null
  audio_key?: string | null
  created_at: string
}

// Las cuatro respuestas son solo imágenes, sin texto (por ejemplo, un test de figuras)
export const answersAreImagesOnly = (options: string[], images?: Array<unknown | null> | null) =>
  options.length > 0 && options.every((option, index) => !option.trim() && !!images?.[index])

export interface Room {
  id: string
  name: string
  code: string // Código único de 6 dígitos
  status: 'waiting' | 'playing' | 'show_results' | 'finished'
  max_players: number
  created_at: string
  created_by_user?: string
  game?: Game
  players?: Player[]
  current_game_data?: Game // Juego completo almacenado en la sala
  current_question_index?: number // Índice de pregunta actual para sincronización
  question_started_at?: string | null // Hora del servidor en que se abre la pregunta actual
}

export interface Player {
  id: string
  room_id: string
  name: string
  avatar: string // Emoji usado como avatar
  score: number
  is_host: boolean
  joined_at: string
}

export interface GameSession {
  id: string
  room_id: string
  game_id: string
  current_question: number
  started_at: string
}

export interface PlayerAnswer {
  id: string
  player_id: string
  question_id: string
  session_id: string
  answer: number // Índice de la respuesta seleccionada
  time_to_answer: number // Tiempo en milisegundos
  is_correct: boolean
  points_earned: number
  answered_at: string
}

export interface QRGameSession {
  id: string
  access_code: string // Código único de 10 caracteres
  game_id: string
  title: string
  description?: string
  max_participants?: number
  expires_at?: string
  is_active: boolean
  created_at: string
  created_by_user?: string
  game?: Game
  games?: Game // La API devuelve como 'games' en las relaciones
}

// Tipos para el estado de la aplicación
export interface AppState {
  currentView: 'welcome' | 'auth' | 'admin' | 'game-room' | 'single-player' | 'qr-access'
  user: UserProfile | null
  currentRoom: Room | null
  currentPlayer: Player | null
  currentGame: Game | null
  isLoading: boolean
  error: string | null
}

// Tipos para eventos en tiempo real
export interface RealtimeEvent {
  type: 'player_joined' | 'player_left' | 'game_started' | 'question_answered' | 'game_ended' | 'room_updated'
  payload: any
}

// Tipos para sonidos
export type SoundType = 'correct' | 'incorrect' | 'tick' | 'timeup' | 'game-start' | 'game-end'

// Tipos para respuestas de la API
export interface ApiResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

// Tipos para estadísticas
export interface GameStats {
  total_questions: number
  correct_answers: number
  incorrect_answers: number
  average_time: number
  total_points: number
  accuracy_percentage: number
}

export interface LeaderboardEntry {
  player: Player
  stats: GameStats
  position: number
}

// Constantes
export const ROOM_CODE_LENGTH = 6
export const QR_CODE_LENGTH = 10
export const MAX_PLAYERS_PER_ROOM = 20
export const DEFAULT_QUESTION_TIME = 30
export const POINTS_BASE = 1000

// Avatares disponibles - IDs que corresponden a los diseños en PlayerAvatar.tsx
export const AVAILABLE_AVATARS = [
  'purple-geo', 'blue-wave', 'red-fire', 'green-nature',
  'orange-sun', 'pink-candy', 'teal-ocean', 'indigo-night',
  'yellow-star', 'cyan-ice', 'rose-garden', 'lime-fresh',
  'violet-magic', 'amber-gold', 'emerald-forest', 'sky-dream',
  'fuchsia-pop', 'slate-modern', 'red-passion', 'blue-electric',
  'green-mint', 'orange-blaze', 'purple-royal', 'pink-blossom',
  'teal-tropical', 'yellow-sunshine', 'indigo-deep', 'rose-sunset',
  'cyan-aqua', 'lime-energy', 'violet-dream', 'amber-warm'
]

// Utilidades de validación
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const isValidRoomCode = (code: string): boolean => {
  return code.length === ROOM_CODE_LENGTH && /^\d+$/.test(code)
}

export const isValidQRCode = (code: string): boolean => {
  return code.length === QR_CODE_LENGTH && /^[A-Z0-9]+$/.test(code)
}

export const generateRoomCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export const generateQRCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < QR_CODE_LENGTH; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Orden mezclado de `count` posiciones que depende solo de la semilla: la misma
// semilla da siempre el mismo orden y semillas distintas dan órdenes distintos.
// Sirve para que cada jugador vea las respuestas en un orden propio que no cambie
// al volver a pintar la pantalla.
export const shuffledOrder = (count: number, seed: string): number[] => {
  // la semilla de texto se reduce a un número (FNV-1a)
  let state = 2166136261
  for (let i = 0; i < seed.length; i++) {
    state ^= seed.charCodeAt(i)
    state = Math.imul(state, 16777619)
  }

  // generador pseudoaleatorio sencillo (mulberry32)
  const random = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const order = Array.from({ length: count }, (_, index) => index)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

// Puntos de una respuesta: hasta 1000 por acertar; se pierde hasta la mitad
// según lo que se tarde respecto al tiempo de la pregunta. Incorrecta = 0.
// Es la misma fórmula que kahoot_points en la base de datos (salas multijugador).
export const calculatePoints = (isCorrect: boolean, timeToAnswer: number, timeLimitSeconds: number): number => {
  if (!isCorrect) return 0
  if (timeToAnswer <= 500) return POINTS_BASE
  const limitMs = timeLimitSeconds * 1000
  return Math.max(POINTS_BASE / 2, Math.round(POINTS_BASE * (1 - (timeToAnswer / limitMs) / 2)))
}