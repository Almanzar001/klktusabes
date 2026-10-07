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
  questions?: Question[]
}

export interface Question {
  id: string
  game_id: string
  text: string
  options: string[] // Array de 4 opciones
  correct_answer: number // Índice de la respuesta correcta (0-3)
  time_limit: number
  order_number: number
  image_url?: string
  created_at: string
}

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

export const calculatePoints = (isCorrect: boolean, timeToAnswer: number): number => {
  if (!isCorrect) return 0
  return Math.round(POINTS_BASE / (timeToAnswer / 1000 + 1))
}