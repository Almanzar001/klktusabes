import React, { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'

interface QuestionMediaProps {
  imageUrl?: string | null
  audioUrl?: string | null
  // El sonido arranca solo al abrirse la pregunta. En una sala solo lo hace el
  // dispositivo que lleva el sonido para todos; los demás lo ponen con el botón,
  // para que no suenen veinte teléfonos a destiempo en el mismo salón.
  autoPlay?: boolean
  // Con el juego silenciado el sonido no arranca solo
  muted?: boolean
}

// Descarga la imagen por adelantado para que ya esté al abrirse la pregunta
export const preloadQuestionImage = (imageUrl?: string | null) => {
  if (imageUrl) new Image().src = imageUrl
}

// Imagen y sonido de una pregunta durante la partida
const QuestionMedia: React.FC<QuestionMediaProps> = ({ imageUrl, audioUrl, autoPlay = false, muted = false }) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [finished, setFinished] = useState(false)
  const [progress, setProgress] = useState(0)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (autoPlay && !muted) {
      // si el navegador no deja sonar sin un toque, queda el botón
      audio.play().catch(() => {})
    }
    // un <audio> sigue sonando aunque salga de la pantalla
    return () => audio.pause()
    // solo al abrirse la pregunta: quitar el silencio después no debe arrancarlo
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
          className="max-h-44 sm:max-h-64 max-w-full rounded-2xl shadow-lg object-contain"
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
