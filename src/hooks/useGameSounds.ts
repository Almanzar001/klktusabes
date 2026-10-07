import { useCallback, useEffect, useRef, useState } from 'react'

// Tipos de sonidos disponibles
export type SoundType = 'correct' | 'incorrect' | 'tick' | 'timeup' | 'game-start' | 'game-end'

// Música de fondo en bucle
export type MusicKind = 'lobby' | 'countdown'

// Interface para el hook
interface UseGameSoundsReturn {
  playCorrect: () => void
  playIncorrect: () => void
  playTick: (urgent?: boolean) => void
  playTimeUp: () => void
  playGameStart: () => void
  playGameEnd: () => void
  playAnswerSent: () => void
  playPlayerJoined: () => void
  startMusic: (kind: MusicKind) => void
  stopMusic: () => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  isMuted: boolean
  initializeAudio: () => Promise<boolean>
  isAudioEnabled: boolean
}

// Frecuencias (Hz) de las notas usadas
const NOTE = {
  G2: 98.0, A2: 110.0, B2: 123.47, C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.0,
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, GS4: 415.3, A4: 440.0, B4: 493.88,
  C5: 523.25, E5: 659.25, G5: 783.99, A5: 880.0, C6: 1046.5, E6: 1318.5
}

interface Voice {
  type: OscillatorType
  volume: number
  length: number // duración de cada nota, en pasos
  steps: number[] // una frecuencia por paso; 0 = silencio
}

interface MusicLoop {
  bpm: number
  voices: Voice[]
  guira: number // volumen del raspado de la güira
}

// La música es un merengue sencillo. Cada compás son 16 semicorcheas (4 tiempos).
// Güira: corchea y dos semicorcheas en cada tiempo ("chk, chi-ki")
const GUIRA_PATTERN = [1, 0, 0.55, 0.7, 1, 0, 0.55, 0.7, 1, 0, 0.55, 0.7, 1, 0, 0.55, 0.7]
// Tambora: golpe grave (1) en cada tiempo y redoble agudo (2) que entra al tiempo siguiente
const TAMBORA_PATTERN = [1, 0, 0, 0, 1, 0, 2, 2, 1, 0, 0, 0, 1, 0, 2, 2]

const MUSIC: Record<MusicKind, MusicLoop> = {
  // Sala de espera: merengue en Do mayor (Do – Sol), bajo y acordeón
  lobby: {
    bpm: 126,
    guira: 0.02,
    voices: [
      {
        type: 'triangle', volume: 0.13, length: 3,
        steps: [NOTE.C3, 0, 0, 0, NOTE.G2, 0, 0, 0, NOTE.G2, 0, 0, 0, NOTE.D3, 0, 0, 0]
      },
      {
        type: 'sawtooth', volume: 0.035, length: 1.6,
        steps: [NOTE.E4, 0, NOTE.G4, NOTE.C5, 0, NOTE.G4, NOTE.E4, 0, NOTE.D4, 0, NOTE.G4, NOTE.B4, 0, NOTE.G4, NOTE.D4, 0]
      }
    ]
  },
  // Pregunta en curso: más rápido y en La menor (La menor – Mi), para dar tensión
  countdown: {
    bpm: 148,
    guira: 0.022,
    voices: [
      {
        type: 'triangle', volume: 0.13, length: 3,
        steps: [NOTE.A2, 0, 0, 0, NOTE.E3, 0, 0, 0, NOTE.E3, 0, 0, 0, NOTE.B2, 0, 0, 0]
      },
      {
        type: 'sawtooth', volume: 0.032, length: 1.6,
        steps: [NOTE.A4, 0, NOTE.C5, NOTE.E5, 0, NOTE.C5, NOTE.A4, 0, NOTE.GS4, 0, NOTE.B4, NOTE.E5, 0, NOTE.B4, NOTE.GS4, 0]
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Motor de audio compartido por toda la app
// ---------------------------------------------------------------------------
// Hay un solo AudioContext para todas las pantallas. Los móviles limitan cuántos
// se pueden crear (iOS, cuatro) y cada uno hay que desbloquearlo con un toque:
// con uno compartido basta el primer toque en cualquier pantalla.

// Ajustes según el dispositivo en el que suena
interface AudioProfile {
  smallSpeaker: boolean // altavoz de teléfono: casi no reproduce graves
  gain: number // volumen general: un teléfono suena más bajo que un portátil
  simpleMusic: boolean // equipo modesto: la música lleva menos notas
  canVibrate: boolean // se acompaña el sonido con vibración
}

const detectProfile = (): AudioProfile => {
  const touch = !!window.matchMedia?.('(pointer: coarse)').matches
  const phone = touch && Math.min(window.screen.width, window.screen.height) < 600
  const cores = navigator.hardwareConcurrency ?? 8
  const memory: number = (navigator as any).deviceMemory ?? 8

  return {
    smallSpeaker: phone,
    gain: phone ? 1 : touch ? 0.85 : 0.7,
    simpleMusic: memory <= 2 || (cores <= 4 && memory <= 4),
    canVibrate: touch && typeof navigator.vibrate === 'function'
  }
}

const readMutedPreference = (): boolean => {
  try {
    const saved = localStorage.getItem('gameSound_muted')
    return saved ? JSON.parse(saved) : false
  } catch {
    return false
  }
}

let context: AudioContext | null = null
let masterGain: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null
let profile: AudioProfile | null = null
let muted = readMutedPreference()
let userVolume = 1
let music: { kind: MusicKind; timer: number | null } | null = null
const lastSoundTime: { [key: string]: number } = {}
const muteListeners = new Set<(muted: boolean) => void>()

const getProfile = (): AudioProfile => {
  if (!profile) profile = detectProfile()
  return profile
}

const outputGain = () => (muted ? 0 : getProfile().gain * userVolume)

// Crear el AudioContext de manera segura
const ensureContext = (): AudioContext | null => {
  if (context) return context

  // Verificar soporte completo de Web Audio API
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioContextClass) {
    console.warn('Web Audio API no soportada en este navegador')
    return null
  }

  try {
    const audioContext: AudioContext = new AudioContextClass({ latencyHint: 'interactive' })

    // Todo pasa por una ganancia maestra: volumen y silencio en un solo punto
    const gain = audioContext.createGain()
    gain.gain.value = outputGain()

    // Limitador: iguala el volumen entre dispositivos y evita que distorsione
    // cuando coinciden varios sonidos
    const limiter = audioContext.createDynamicsCompressor()
    limiter.threshold.value = -12
    limiter.knee.value = 10
    limiter.ratio.value = 8
    limiter.attack.value = 0.003
    limiter.release.value = 0.15

    gain.connect(limiter)
    limiter.connect(audioContext.destination)

    context = audioContext
    masterGain = gain
  } catch (error) {
    console.warn('Error creando AudioContext:', error)
    return null
  }

  return context
}

// Los navegadores solo dejan sonar tras un gesto del usuario, y los móviles
// vuelven a suspender el audio al cambiar de app o recibir una llamada: se
// reanuda en cada toque si hace falta.
const unlockAudio = () => {
  const audioContext = ensureContext()
  if (!audioContext || audioContext.state === 'running') return

  audioContext.resume().catch(() => {})

  // iOS necesita que algo suene dentro del gesto para desbloquear el audio
  try {
    const silence = audioContext.createBufferSource()
    silence.buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate)
    silence.connect(audioContext.destination)
    silence.start()
  } catch {
    // sin desbloqueo extra; el resume anterior basta en el resto de navegadores
  }
}

// Contexto listo para sonar, o null si no hay audio disponible
const readyContext = (): AudioContext | null => {
  const audioContext = ensureContext()
  if (!audioContext || !masterGain) return null
  if (audioContext.state !== 'running' && !document.hidden) {
    audioContext.resume().catch(() => {})
  }
  return audioContext
}

// Nota con ataque rápido y caída suave. `glideTo` desliza el tono hasta otra frecuencia.
const tone = (
  audioContext: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  glideTo?: number
) => {
  // El altavoz de un teléfono no reproduce graves: lo más bajo sube una octava
  // y usa una onda con más armónicos para que la nota se siga distinguiendo
  if (getProfile().smallSpeaker && frequency < 300) {
    if (frequency < 180) {
      frequency *= 2
      if (glideTo) glideTo *= 2
    }
    if (type === 'sine' || type === 'triangle') {
      type = 'sawtooth'
      volume *= 0.8
    }
  }

  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startTime)
  if (glideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(glideTo, startTime + duration)
  }

  gainNode.gain.setValueAtTime(0.0001, startTime)
  gainNode.gain.exponentialRampToValueAtTime(volume, startTime + 0.012)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  oscillator.connect(gainNode)
  gainNode.connect(masterGain!)

  oscillator.start(startTime)
  oscillator.stop(startTime + duration + 0.02)
  oscillator.onended = () => {
    oscillator.disconnect()
    gainNode.disconnect()
  }
}

// Ráfaga corta de ruido filtrado: el raspado de la güira
const guira = (audioContext: AudioContext, startTime: number, volume: number) => {
  if (!noiseBuffer) {
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.05, audioContext.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1
    }
    noiseBuffer = buffer
  }

  const source = audioContext.createBufferSource()
  const filter = audioContext.createBiquadFilter()
  const gainNode = audioContext.createGain()

  source.buffer = noiseBuffer
  filter.type = 'highpass'
  filter.frequency.value = 6000
  gainNode.gain.setValueAtTime(volume, startTime)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.04)

  source.connect(filter)
  filter.connect(gainNode)
  gainNode.connect(masterGain!)

  source.start(startTime)
  source.onended = () => {
    source.disconnect()
    filter.disconnect()
    gainNode.disconnect()
  }
}

// Vibración que acompaña al sonido en los teléfonos que la admiten
const buzz = (pattern: number | number[]) => {
  if (muted || !getProfile().canVibrate) return
  try {
    navigator.vibrate(pattern)
  } catch {
    // sin vibración
  }
}

// Evita repetir el mismo efecto demasiado seguido
const tooSoon = (key: string, minInterval: number) => {
  const now = Date.now()
  if (now - (lastSoundTime[key] || 0) < minInterval) return true
  lastSoundTime[key] = now
  return false
}

// Respuesta correcta: arpegio brillante ascendente con remate
const playCorrect = () => {
  const audioContext = readyContext()
  if (!audioContext || tooSoon('correct', 300)) return
  const t = audioContext.currentTime
  ;[NOTE.C5, NOTE.E5, NOTE.G5].forEach((frequency, index) => {
    tone(audioContext, frequency, t + index * 0.08, 0.16, 'triangle', 0.22)
  })
  tone(audioContext, NOTE.C6, t + 0.24, 0.5, 'triangle', 0.24)
  tone(audioContext, NOTE.E6, t + 0.24, 0.5, 'sine', 0.1)
  buzz([25, 40, 25])
}

// Respuesta incorrecta: dos notas graves que caen
const playIncorrect = () => {
  const audioContext = readyContext()
  if (!audioContext || tooSoon('incorrect', 300)) return
  const t = audioContext.currentTime
  tone(audioContext, 233.08, t, 0.2, 'sawtooth', 0.11, 207.65)
  tone(audioContext, 174.61, t + 0.2, 0.42, 'sawtooth', 0.12, 146.83)
  tone(audioContext, 87.31, t + 0.2, 0.42, 'sine', 0.2)
  buzz(160)
}

// Tic del reloj; más agudo y doble en los últimos segundos
const playTick = (urgent = false) => {
  const audioContext = readyContext()
  if (!audioContext || tooSoon('tick', 400)) return
  const t = audioContext.currentTime
  tone(audioContext, urgent ? 1320 : 990, t, 0.06, 'sine', 0.2, urgent ? 880 : 660)
  if (urgent) {
    tone(audioContext, 1320, t + 0.12, 0.06, 'sine', 0.16, 880)
  }
}

// Tiempo agotado: tres notas que bajan y un golpe grave
const playTimeUp = () => {
  const audioContext = readyContext()
  if (!audioContext || tooSoon('timeup', 1000)) return
  const t = audioContext.currentTime
  ;[NOTE.G4, NOTE.E4, NOTE.C4].forEach((frequency, index) => {
    tone(audioContext, frequency, t + index * 0.13, 0.18, 'triangle', 0.2)
  })
  tone(audioContext, NOTE.C3, t + 0.39, 0.6, 'triangle', 0.26)
  buzz([70, 60, 70])
}

// Inicio del juego: fanfarria que sube y termina en acorde
const playGameStart = () => {
  const audioContext = readyContext()
  if (!audioContext || tooSoon('game-start', 1000)) return
  const t = audioContext.currentTime
  ;[NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5].forEach((frequency, index) => {
    tone(audioContext, frequency, t + index * 0.09, 0.14, 'triangle', 0.2)
  })
  ;[NOTE.C5, NOTE.E5, NOTE.G5].forEach((frequency) => {
    tone(audioContext, frequency, t + 0.36, 0.6, 'triangle', 0.14)
  })
}

// Fin del juego: "ta-ta-ta-taaa" de victoria
const playGameEnd = () => {
  const audioContext = readyContext()
  if (!audioContext || tooSoon('game-end', 1000)) return
  const t = audioContext.currentTime
  ;[0, 0.14, 0.28].forEach((offset) => {
    tone(audioContext, NOTE.G4, t + offset, 0.12, 'square', 0.07)
    tone(audioContext, NOTE.G3, t + offset, 0.12, 'triangle', 0.14)
  })
  tone(audioContext, NOTE.C5, t + 0.42, 0.34, 'square', 0.07)
  tone(audioContext, NOTE.E5, t + 0.76, 0.16, 'square', 0.06)
  ;[NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((frequency) => {
    tone(audioContext, frequency, t + 0.92, 1.1, 'triangle', 0.13)
  })
  tone(audioContext, NOTE.C3, t + 0.92, 1.1, 'triangle', 0.2)
}

// Respuesta enviada: "pop" corto que sube
const playAnswerSent = () => {
  const audioContext = readyContext()
  if (!audioContext || tooSoon('answer-sent', 200)) return
  tone(audioContext, 420, audioContext.currentTime, 0.11, 'sine', 0.24, 880)
  buzz(15)
}

// Entra un jugador a la sala: dos notas suaves
const playPlayerJoined = () => {
  const audioContext = readyContext()
  if (!audioContext || tooSoon('player-joined', 150)) return
  const t = audioContext.currentTime
  tone(audioContext, NOTE.E5, t, 0.1, 'sine', 0.16)
  tone(audioContext, NOTE.A5, t + 0.08, 0.16, 'sine', 0.16)
}

// --- Música en bucle ---

const pauseMusic = () => {
  if (music && music.timer !== null) {
    window.clearInterval(music.timer)
    music.timer = null
  }
}

// Se programan las notas un poco por adelantado sobre el reloj del AudioContext
// para que el ritmo no dependa de los temporizadores del navegador
const scheduleMusic = () => {
  const audioContext = readyContext()
  if (!audioContext || !music || music.timer !== null) return

  const { bpm, guira: guiraVolume, voices } = MUSIC[music.kind]
  const simple = getProfile().simpleMusic
  // en un teléfono la melodía es lo que mejor se oye: se sube para que la música no quede floja
  const melodyBoost = getProfile().smallSpeaker ? 1.8 : 1
  // en equipos modestos se adelanta más trabajo cada vez y se despierta menos
  const lookahead = simple ? 0.4 : 0.25
  const stepSeconds = 60 / bpm / 4
  let step = 0
  let nextTime = audioContext.currentTime + 0.06

  const schedule = () => {
    // tras una pausa larga se retoma desde ahora en vez de tocar lo atrasado de golpe
    if (nextTime < audioContext.currentTime) {
      nextTime = audioContext.currentTime + 0.06
    }
    while (nextTime < audioContext.currentTime + lookahead) {
      for (const voice of voices) {
        const frequency = voice.steps[step % voice.steps.length]
        if (frequency) {
          const volume = frequency >= 250 ? voice.volume * melodyBoost : voice.volume
          tone(audioContext, frequency, nextTime, stepSeconds * voice.length, voice.type, volume)
        }
      }
      const guiraAccent = GUIRA_PATTERN[step % GUIRA_PATTERN.length]
      // en equipos modestos la güira solo marca los tiempos
      if (guiraAccent && (!simple || guiraAccent === 1)) {
        guira(audioContext, nextTime, guiraVolume * guiraAccent)
      }
      const tamboraHit = TAMBORA_PATTERN[step % TAMBORA_PATTERN.length]
      if (tamboraHit === 1) {
        tone(audioContext, 120, nextTime, 0.14, 'sine', 0.2, 55)
      } else if (tamboraHit === 2) {
        tone(audioContext, 240, nextTime, 0.07, 'triangle', 0.1, 170)
      }
      nextTime += stepSeconds
      step++
    }
  }

  schedule()
  music.timer = window.setInterval(schedule, simple ? 100 : 60)
}

const startMusic = (kind: MusicKind) => {
  if (music?.kind === kind) return
  pauseMusic()
  music = { kind, timer: null }
  if (!document.hidden) scheduleMusic()
}

const stopMusic = () => {
  pauseMusic()
  music = null
}

// --- Volumen y silencio ---

const applyOutputGain = () => {
  if (masterGain) masterGain.gain.value = outputGain()
}

const setVolume = (volume: number) => {
  userVolume = Math.max(0, Math.min(1, volume))
  applyOutputGain()
}

// Toggle mute con persistencia
const toggleMute = () => {
  muted = !muted
  applyOutputGain()
  try {
    localStorage.setItem('gameSound_muted', JSON.stringify(muted))
  } catch (e) {
    console.warn('No se pudo guardar preferencia de audio:', e)
  }
  muteListeners.forEach(listener => listener(muted))
}

if (typeof window !== 'undefined') {
  for (const eventType of ['pointerdown', 'touchend', 'keydown', 'click']) {
    window.addEventListener(eventType, unlockAudio, { capture: true, passive: true })
  }

  // Con la app en segundo plano no debe sonar nada ni gastarse batería
  document.addEventListener('visibilitychange', () => {
    if (!context) return
    if (document.hidden) {
      pauseMusic()
      context.suspend().catch(() => {})
    } else {
      context.resume().catch(() => {})
      scheduleMusic()
    }
  })
}

interface UseGameSoundsOptions {
  // Este dispositivo lleva el sonido de la partida para todos (quien la dirige).
  // En iPhone suena aunque el interruptor de silencio esté puesto; el resto de
  // dispositivos respeta ese interruptor.
  playsAloud?: boolean
}

export const useGameSounds = ({ playsAloud = false }: UseGameSoundsOptions = {}): UseGameSoundsReturn => {
  const [isMuted, setIsMuted] = useState(muted)
  const [isAudioEnabled, setIsAudioEnabled] = useState(() => context?.state === 'running')

  // El silencio es global: todas las pantallas lo reflejan
  useEffect(() => {
    setIsMuted(muted)
    muteListeners.add(setIsMuted)
    return () => {
      muteListeners.delete(setIsMuted)
    }
  }, [])

  useEffect(() => {
    const audioSession = (navigator as any).audioSession
    if (!playsAloud || !audioSession) return

    const previousType = audioSession.type
    audioSession.type = 'playback'
    return () => {
      audioSession.type = previousType
    }
  }, [playsAloud])

  // Función para inicializar audio manualmente (requerido por navegadores)
  const initializeAudio = useCallback(async (): Promise<boolean> => {
    unlockAudio()
    const enabled = !!context
    setIsAudioEnabled(enabled)
    return enabled
  }, [])

  return {
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
    setVolume,
    toggleMute,
    isMuted,
    initializeAudio,
    isAudioEnabled
  }
}

// Hook alternativo usando archivos de audio (si prefieres usar archivos MP3/WAV)
export const useGameSoundsWithFiles = (): UseGameSoundsReturn => {
  const audioRefs = useRef<{ [key in SoundType]?: HTMLAudioElement }>({})
  const volumeRef = useRef<number>(0.5)
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gameSound_muted')
      return saved ? JSON.parse(saved) : false
    } catch {
      return false
    }
  })
  const [isAudioEnabled, setIsAudioEnabled] = useState(false)

  // URLs de archivos de sonido (coloca los archivos en public/sounds/)
  const soundFiles: { [key in SoundType]: string } = {
    correct: '/sounds/correct.mp3',
    incorrect: '/sounds/incorrect.mp3',
    tick: '/sounds/tick.mp3',
    timeup: '/sounds/timeup.mp3',
    'game-start': '/sounds/game-start.mp3',
    'game-end': '/sounds/game-end.mp3'
  }

  // Precargar archivos de audio
  const preloadSound = useCallback((soundType: SoundType) => {
    if (!audioRefs.current[soundType]) {
      const audio = new Audio(soundFiles[soundType])
      audio.volume = volumeRef.current
      audio.preload = 'auto'
      audioRefs.current[soundType] = audio
    }
  }, [soundFiles])

  // Función para inicializar audio con archivos
  const initializeAudio = useCallback(async (): Promise<boolean> => {
    try {
      // Test con un archivo de audio silencioso
      const testAudio = new Audio()
      testAudio.volume = 0.001
      testAudio.muted = true
      
      // Intentar reproducir un sonido mudo para activar contexto de audio
      const playPromise = testAudio.play()
      if (playPromise) {
        await playPromise
        testAudio.pause()
      }
      
      setIsAudioEnabled(true)
      return true
    } catch (error) {
      console.warn('Error inicializando audio con archivos:', error)
      setIsAudioEnabled(false)
      return false
    }
  }, [])

  // Función para reproducir sonido desde archivo
  const playFileSound = useCallback((soundType: SoundType) => {
    if (isMuted) return

    try {
      preloadSound(soundType)
      const audio = audioRefs.current[soundType]
      
      if (audio) {
        audio.currentTime = 0
        audio.volume = volumeRef.current
        audio.play().catch(error => {
          console.warn(`Error reproduciendo ${soundType}:`, error)
        })
      }
    } catch (error) {
      console.warn(`Error con archivo de sonido ${soundType}:`, error)
    }
  }, [preloadSound])

  const playCorrect = useCallback(() => playFileSound('correct'), [playFileSound])
  const playIncorrect = useCallback(() => playFileSound('incorrect'), [playFileSound])
  const playTick = useCallback(() => playFileSound('tick'), [playFileSound])
  const playTimeUp = useCallback(() => playFileSound('timeup'), [playFileSound])
  const playGameStart = useCallback(() => playFileSound('game-start'), [playFileSound])
  const playGameEnd = useCallback(() => playFileSound('game-end'), [playFileSound])

  // Sin archivo propio: esta variante no incluye estos efectos ni música
  const playAnswerSent = useCallback(() => {}, [])
  const playPlayerJoined = useCallback(() => {}, [])
  const startMusic = useCallback(() => {}, [])
  const stopMusic = useCallback(() => {}, [])

  const setVolume = useCallback((volume: number) => {
    volumeRef.current = Math.max(0, Math.min(1, volume))
    
    // Actualizar volumen de todos los audios cargados
    Object.values(audioRefs.current).forEach(audio => {
      if (audio) {
        audio.volume = volumeRef.current
      }
    })
  }, [])

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newValue = !prev
      try {
        localStorage.setItem('gameSound_muted', JSON.stringify(newValue))
      } catch (e) {
        console.warn('No se pudo guardar preferencia de audio:', e)
      }
      return newValue
    })
  }, [])

  return {
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
    setVolume,
    toggleMute,
    isMuted,
    initializeAudio,
    isAudioEnabled
  }
}

export default useGameSounds