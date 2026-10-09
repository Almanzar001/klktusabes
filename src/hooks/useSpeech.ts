import { useCallback, useEffect, useRef, useState } from 'react'

// Lectura en voz alta con la voz del propio dispositivo (Web Speech API). No
// descarga ni guarda audio: cada teléfono o computadora usa la voz que trae.

export interface SpeechSegment {
  text: string
  // Identifica lo que se está leyendo, para poder resaltarlo en pantalla
  id?: string | number
}

interface SpeakOptions {
  // Se pone a la cola de lo que ya se está leyendo, en vez de interrumpirlo
  append?: boolean
  // Se llama cuando termina toda la lectura, también si se corta o el navegador no deja hablar
  onDone?: () => void
}

const synth: SpeechSynthesis | null =
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null

// Voz en español; mejor latinoamericana si el dispositivo la tiene
const LANGUAGES = ['es-do', 'es-us', 'es-mx', 'es-419', 'es-co', 'es-ar', 'es-es']
const NATURAL_VOICES = /google|microsoft|siri|paulina|m[oó]nica|sabina|helena/i

const pickVoice = () => {
  const voices = (synth?.getVoices() ?? []).filter(voice => voice.lang.toLowerCase().startsWith('es'))
  const score = (voice: SpeechSynthesisVoice) => {
    const language = LANGUAGES.indexOf(voice.lang.toLowerCase().replace('_', '-'))
    return (language === -1 ? LANGUAGES.length : language) * 2 + (NATURAL_VOICES.test(voice.name) ? 0 : 1)
  }
  return voices.sort((a, b) => score(a) - score(b))[0] ?? null
}

if (synth) {
  // Algunos navegadores cargan las voces más tarde; pedirlas ya las deja listas
  synth.getVoices()

  // En iPhone la primera frase tiene que salir de un toque del usuario: se
  // aprovecha el primero para dejar la voz desbloqueada con una frase vacía
  const unlock = () => synth.speak(new SpeechSynthesisUtterance(''))
  window.addEventListener('pointerdown', unlock, { once: true })
}

// Hay navegadores que aceptan la frase pero nunca llegan a decirla. Si pasa una
// vez, se deja de intentar: es mejor quedarse sin voz que tener la partida esperando.
const START_TIMEOUT_MS = 4000
let engineFailed = false

export const useSpeech = () => {
  const [speaking, setSpeaking] = useState(false)
  const [currentId, setCurrentId] = useState<string | number | null>(null)
  const [failed, setFailed] = useState(engineFailed)
  const run = useRef(0) // cambia al interrumpir: los avisos de las frases anteriores ya no cuentan
  const pending = useRef(0)
  const pendingChars = useRef(0)
  const doneCallbacks = useRef<Array<() => void>>([])
  // Chrome descarta las frases antes de que terminen si nadie las guarda
  const utterances = useRef<SpeechSynthesisUtterance[]>([])
  const watchdog = useRef<number>()
  const startWatchdog = useRef<number>()

  const finish = useCallback(() => {
    window.clearTimeout(watchdog.current)
    window.clearTimeout(startWatchdog.current)
    pending.current = 0
    pendingChars.current = 0
    utterances.current = []
    setSpeaking(false)
    setCurrentId(null)
    const callbacks = doneCallbacks.current
    doneCallbacks.current = []
    callbacks.forEach(callback => callback())
  }, [])

  const stop = useCallback(() => {
    run.current++
    // cancelar sin nada en curso hace que algunos navegadores se traguen la frase siguiente
    if (synth && (synth.speaking || synth.pending)) synth.cancel()
    finish()
  }, [finish])

  const speak = useCallback((segments: SpeechSegment[], { append = false, onDone }: SpeakOptions = {}) => {
    if (!synth || engineFailed) {
      onDone?.()
      return
    }

    if (!append) stop()
    if (onDone) doneCallbacks.current.push(onDone)

    const spoken = segments.filter(segment => segment.text.trim())
    if (!spoken.length) {
      if (!pending.current) finish()
      return
    }

    const id = run.current
    const voice = pickVoice()

    // Con la cola vacía, la primera frase tiene que empezar a sonar enseguida
    if (!pending.current) {
      window.clearTimeout(startWatchdog.current)
      startWatchdog.current = window.setTimeout(() => {
        if (run.current !== id) return
        engineFailed = true
        setFailed(true)
        stop()
      }, START_TIMEOUT_MS)
    }
    spoken.forEach(segment => {
      const utterance = new SpeechSynthesisUtterance(segment.text)
      if (voice) utterance.voice = voice
      utterance.lang = voice?.lang ?? 'es-US'
      utterance.rate = 0.9 // un poco más despacio, para niños
      utterance.onstart = () => {
        if (run.current !== id) return
        window.clearTimeout(startWatchdog.current)
        setCurrentId(segment.id ?? null)
      }
      const done = () => {
        if (run.current !== id) return
        pending.current--
        if (pending.current <= 0) finish()
      }
      utterance.onend = done
      utterance.onerror = done

      pending.current++
      pendingChars.current += segment.text.length
      utterances.current.push(utterance)
      synth.speak(utterance)
    })
    setSpeaking(true)

    // Si el navegador nunca avisa de que terminó, no dejar nada esperando para siempre
    window.clearTimeout(watchdog.current)
    watchdog.current = window.setTimeout(() => {
      if (run.current === id) stop()
    }, 5000 + pending.current * 2000 + pendingChars.current * 150)
  }, [finish, stop])

  useEffect(() => stop, [stop])

  return { canSpeak: !!synth && !failed, speaking, currentId, speak, stop }
}

export default useSpeech
