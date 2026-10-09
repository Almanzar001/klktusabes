import React, { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Question } from '../types'

interface QuestionMediaProps {
  imageUrl?: string | null
  audioUrl?: string | null
  // El sonido arranca solo al abrirse la pregunta. En una sala solo lo hace el
  // dispositivo que lleva el sonido para todos; los demás lo ponen con el botón,
  // para que no suenen veinte teléfonos a destiempo en el mismo salón.
  autoPlay?: boolean
  // Con el juego silenciado el sonido no arranca solo
  muted?: boolean
  // La imagen es lo principal de la pregunta (las respuestas son figuras): se muestra más grande
  largeImage?: boolean
  // El sonido espera para arrancar solo (por ejemplo, mientras la app lee la pregunta en voz alta)
  hold?: boolean
}

// Descarga por adelantado las imágenes de la pregunta y de sus respuestas,
// para que ya estén al abrirse la pregunta
export const preloadQuestionImages = (question?: Pick<Question, 'image_url' | 'option_images'> | null) => {
  const urls = [question?.image_url, ...(question?.option_images ?? []).map(image => image?.url)]
  urls.forEach(url => {
    if (url) new Image().src = url
  })
}

// Imagen y sonido de una pregunta durante la partida
const QuestionMedia: React.FC<QuestionMediaProps> = ({ imageUrl, audioUrl, autoPlay = false, muted = false, largeImage = false, hold = false }) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [finished, setFinished] = useState(false)
  const [progress, setProgress] = useState(0)
  const [imageFailed, setImageFailed] = useState(false)
  const autoStarted = useRef(false)

  // Arranca solo una vez, al abrirse la pregunta o en cuanto deja de tener que
  // esperar. Quitar el silencio después no debe arrancarlo.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || hold || autoStarted.current) return

    autoStarted.current = true
    if (autoPlay && !muted) {
      // si el navegador no deja sonar sin un toque, queda el botón
      audio.play().catch(() => {})
    }
  }, [audioUrl, hold])

  useEffect(() => {
    const audio = audioRef.current
    // un <audio> sigue sonando aunque salga de la pantalla
    return () => audio?.pause()
  }, [audioUrl])

  useEffect(() => {
    if (muted) audioRef.current?.pause()
  }, [muted])

  const toggleAudio = () => {
    const audio = audioRef.current
    if (!audio) return

    if (!audio.paused) {
      audio.pause()
      return
    }
    if (audio.ended) audio.currentTime = 0
    audio.play().catch(() => {})
  }

  if (!audioUrl && (!imageUrl || imageFailed)) return null

  return (
    <div className="flex flex-col items-center gap-3">
      {imageUrl && !imageFailed && (
        <img
          src={imageUrl}
          alt="Imagen de la pregunta"
          decoding="async"
          onError={() => setImageFailed(true)}
          className={`${largeImage ? 'max-h-60 sm:max-h-[38vh]' : 'max-h-44 sm:max-h-64'} max-w-full rounded-2xl shadow-lg object-contain`}
        />
      )}

      {audioUrl && (
        <>
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="auto"
            onPlay={() => {
              setPlaying(true)
              setFinished(false)
            }}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false)
              setFinished(true)
              setProgress(0)
            }}
            onTimeUpdate={(e) => {
              const audio = e.currentTarget
              setProgress(audio.duration ? audio.currentTime / audio.duration : 0)
            }}
          />
          <button
            type="button"
            onClick={toggleAudio}
            className={`relative overflow-hidden flex items-center gap-2 rounded-full px-6 py-3 font-display text-xl text-white shadow-lg transition-transform active:scale-95 ${
              playing ? 'bg-larimar' : 'bg-dominican-blue animate-pop-in'
            }`}
          >
            <span
              className="absolute inset-y-0 left-0 bg-white/25 transition-[width] duration-200 ease-linear"
              style={{ width: `${Math.round(progress * 100)}%` }}
              aria-hidden="true"
            />
            <span className="relative flex items-center gap-2">
              {playing ? <Pause className="w-5 h-5" /> : finished ? <RotateCcw className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              {playing ? 'Sonando…' : finished ? 'Escuchar otra vez' : 'Escuchar'}
            </span>
          </button>
        </>
      )}
    </div>
  )
}

export default QuestionMedia
