import { useCallback, useRef, useState } from 'react'

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

export const useGameSounds = (): UseGameSoundsReturn => {
  const audioContextRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const noiseBufferRef = useRef<AudioBuffer | null>(null)
  const musicRef = useRef<{ kind: MusicKind; timer: number } | null>(null)
  const volumeRef = useRef<number>(0.5)
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gameSound_muted')
      return saved ? JSON.parse(saved) : false
    } catch {
      return false
    }
  })
  const mutedRef = useRef(isMuted)
  const lastSoundTime = useRef<{ [key: string]: number }>({})
  const [isAudioEnabled, setIsAudioEnabled] = useState(false)

  // Inicializar AudioContext de manera segura
  const getAudioContext = useCallback((): AudioContext | null => {
    if (!audioContextRef.current) {
      try {
        // Verificar soporte completo de Web Audio API
        if (!window.AudioContext && !(window as any).webkitAudioContext) {
          console.warn('Web Audio API no soportada en este navegador')
          return null
        }
        
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        const audioContext: AudioContext = new AudioContextClass()
        audioContextRef.current = audioContext

        // Todo pasa por una ganancia maestra: volumen y silencio en un solo punto
        const masterGain = audioContext.createGain()
        masterGain.gain.value = mutedRef.current ? 0 : volumeRef.current
        masterGain.connect(audioContext.destination)
        masterGainRef.current = masterGain
        
        // Intentar reanudar inmediatamente si está suspendido
        if (audioContext.state === 'suspended') {
          audioContext.resume().catch(err => {
            console.warn('No se pudo reanudar AudioContext automáticamente:', err)
          })
        }
        
        setIsAudioEnabled(true)
      } catch (error) {
        console.warn('Error creando AudioContext:', error)
        return null
      }
    }
    return audioContextRef.current
  }, [])

  // Función para inicializar audio manualmente (requerido por navegadores)
  const initializeAudio = useCallback(async (): Promise<boolean> => {
    const audioContext = getAudioContext()
    if (!audioContext) return false
    
    try {
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      
      setIsAudioEnabled(true)
      return true
    } catch (error) {
      console.warn('Error inicializando audio:', error)
      setIsAudioEnabled(false)
      return false
    }
  }, [getAudioContext])

  // Contexto listo para sonar, o null si no hay audio disponible
  const readyContext = useCallback((): AudioContext | null => {
    const audioContext = getAudioContext()
    if (!audioContext || !masterGainRef.current) return null
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {})
    }
    return audioContext
  }, [getAudioContext])

  // Nota con ataque rápido y caída suave. `glideTo` desliza el tono hasta otra frecuencia.
  const tone = useCallback((
    audioContext: AudioContext,
    frequency: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    glideTo?: number
  ) => {
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
    gainNode.connect(masterGainRef.current!)

    oscillator.start(startTime)
    oscillator.stop(startTime + duration + 0.02)
    oscillator.onended = () => {
      oscillator.disconnect()
      gainNode.disconnect()
    }
  }, [])

  // Ráfaga corta de ruido filtrado: el raspado de la güira
  const guira = useCallback((audioContext: AudioContext, startTime: number, volume: number) => {
    if (!noiseBufferRef.current) {
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.05, audioContext.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1
      }
      noiseBufferRef.current = buffer
    }

    const source = audioContext.createBufferSource()
    const filter = audioContext.createBiquadFilter()
    const gainNode = audioContext.createGain()

    source.buffer = noiseBufferRef.current
    filter.type = 'highpass'
    filter.frequency.value = 6000
    gainNode.gain.setValueAtTime(volume, startTime)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.04)

    source.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(masterGainRef.current!)

    source.start(startTime)
    source.onended = () => {
      source.disconnect()
      filter.disconnect()
      gainNode.disconnect()
    }
  }, [])

  // Evita repetir el mismo efecto demasiado seguido
  const tooSoon = useCallback((key: string, minInterval: number) => {
    const now = Date.now()
    if (now - (lastSoundTime.current[key] || 0) < minInterval) return true
    lastSoundTime.current[key] = now
    return false
  }, [])

  // Respuesta correcta: arpegio brillante ascendente con remate
  const playCorrect = useCallback(() => {
    const audioContext = readyContext()
    if (!audioContext || tooSoon('correct', 300)) return
    const t = audioContext.currentTime
    ;[NOTE.C5, NOTE.E5, NOTE.G5].forEach((frequency, index) => {
      tone(audioContext, frequency, t + index * 0.08, 0.16, 'triangle', 0.22)
    })
    tone(audioContext, NOTE.C6, t + 0.24, 0.5, 'triangle', 0.24)
    tone(audioContext, NOTE.E6, t + 0.24, 0.5, 'sine', 0.1)
  }, [readyContext, tone, tooSoon])

  // Respuesta incorrecta: dos notas graves que caen
  const playIncorrect = useCallback(() => {
    const audioContext = readyContext()
    if (!audioContext || tooSoon('incorrect', 300)) return
    const t = audioContext.currentTime
    tone(audioContext, 233.08, t, 0.2, 'sawtooth', 0.11, 207.65)
    tone(audioContext, 174.61, t + 0.2, 0.42, 'sawtooth', 0.12, 146.83)
    tone(audioContext, 87.31, t + 0.2, 0.42, 'sine', 0.2)
  }, [readyContext, tone, tooSoon])

  // Tic del reloj; más agudo y doble en los últimos segundos
  const playTick = useCallback((urgent = false) => {
    const audioContext = readyContext()
    if (!audioContext || tooSoon('tick', 400)) return
    const t = audioContext.currentTime
    tone(audioContext, urgent ? 1320 : 990, t, 0.06, 'sine', 0.2, urgent ? 880 : 660)
    if (urgent) {
      tone(audioContext, 1320, t + 0.12, 0.06, 'sine', 0.16, 880)
    }
  }, [readyContext, tone, tooSoon])

  // Tiempo agotado: tres notas que bajan y un golpe grave
  const playTimeUp = useCallback(() => {
    const audioContext = readyContext()
    if (!audioContext || tooSoon('timeup', 1000)) return
    const t = audioContext.currentTime
    ;[NOTE.G4, NOTE.E4, NOTE.C4].forEach((frequency, index) => {
      tone(audioContext, frequency, t + index * 0.13, 0.18, 'triangle', 0.2)
    })
    tone(audioContext, NOTE.C3, t + 0.39, 0.6, 'triangle', 0.26)
  }, [readyContext, tone, tooSoon])

  // Inicio del juego: fanfarria que sube y termina en acorde
  const playGameStart = useCallback(() => {
    const audioContext = readyContext()
    if (!audioContext || tooSoon('game-start', 1000)) return
    const t = audioContext.currentTime
    ;[NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5].forEach((frequency, index) => {
      tone(audioContext, frequency, t + index * 0.09, 0.14, 'triangle', 0.2)
    })
    ;[NOTE.C5, NOTE.E5, NOTE.G5].forEach((frequency) => {
      tone(audioContext, frequency, t + 0.36, 0.6, 'triangle', 0.14)
    })
  }, [readyContext, tone, tooSoon])

  // Fin del juego: "ta-ta-ta-taaa" de victoria
  const playGameEnd = useCallback(() => {
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
  }, [readyContext, tone, tooSoon])

  // Respuesta enviada: "pop" corto que sube
  const playAnswerSent = useCallback(() => {
    const audioContext = readyContext()
    if (!audioContext || tooSoon('answer-sent', 200)) return
    tone(audioContext, 420, audioContext.currentTime, 0.11, 'sine', 0.24, 880)
  }, [readyContext, tone, tooSoon])

  // Entra un jugador a la sala: dos notas suaves
  const playPlayerJoined = useCallback(() => {
    const audioContext = readyContext()
    if (!audioContext || tooSoon('player-joined', 150)) return
    const t = audioContext.currentTime
    tone(audioContext, NOTE.E5, t, 0.1, 'sine', 0.16)
    tone(audioContext, NOTE.A5, t + 0.08, 0.16, 'sine', 0.16)
  }, [readyContext, tone, tooSoon])

  const stopMusic = useCallback(() => {
    if (musicRef.current) {
      window.clearInterval(musicRef.current.timer)
      musicRef.current = null
    }
  }, [])

  // Música en bucle: se programan las notas un poco por adelantado sobre el
  // reloj del AudioContext para que el ritmo no dependa de los temporizadores
  const startMusic = useCallback((kind: MusicKind) => {
    if (musicRef.current?.kind === kind) return
    stopMusic()

    const audioContext = readyContext()
    if (!audioContext) return

    const { bpm, guira: guiraVolume, voices } = MUSIC[kind]
    const stepSeconds = 60 / bpm / 4
    let step = 0
    let nextTime = audioContext.currentTime + 0.06

    const schedule = () => {
      // tras una pausa larga (pestaña en segundo plano) se retoma desde ahora
      if (nextTime < audioContext.currentTime) {
        nextTime = audioContext.currentTime + 0.06
      }
      while (nextTime < audioContext.currentTime + 0.25) {
        for (const voice of voices) {
          const frequency = voice.steps[step % voice.steps.length]
          if (frequency) {
            tone(audioContext, frequency, nextTime, stepSeconds * voice.length, voice.type, voice.volume)
          }
        }
        const guiraAccent = GUIRA_PATTERN[step % GUIRA_PATTERN.length]
        if (guiraAccent) {
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
    musicRef.current = { kind, timer: window.setInterval(schedule, 60) }
  }, [readyContext, stopMusic, tone, guira])

  // Control de volumen
  const setVolume = useCallback((volume: number) => {
    volumeRef.current = Math.max(0, Math.min(1, volume))
    if (masterGainRef.current && !mutedRef.current) {
      masterGainRef.current.gain.value = volumeRef.current
    }
  }, [])

  // Toggle mute con persistencia
  const toggleMute = useCallback(() => {
    const newValue = !mutedRef.current
    mutedRef.current = newValue
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = newValue ? 0 : volumeRef.current
    }
    try {
      localStorage.setItem('gameSound_muted', JSON.stringify(newValue))
    } catch (e) {
      console.warn('No se pudo guardar preferencia de audio:', e)
    }
    setIsMuted(newValue)
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