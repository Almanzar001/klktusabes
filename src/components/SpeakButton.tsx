import React from 'react'
import { Square, Volume2 } from 'lucide-react'

interface SpeakButtonProps {
  speaking: boolean
  onClick: () => void
  className?: string
}

// Botón para que la app lea la pregunta en voz alta (o deje de leerla)
const SpeakButton: React.FC<SpeakButtonProps> = ({ speaking, onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center justify-center w-12 h-12 rounded-full border-4 border-white text-white shadow-lg transition-transform active:scale-90 ${
      speaking ? 'bg-dominican-red animate-pulse' : 'bg-larimar hover:brightness-110'
    } ${className}`}
    title={speaking ? 'Dejar de leer' : 'Leer la pregunta en voz alta'}
    aria-label={speaking ? 'Dejar de leer' : 'Leer la pregunta en voz alta'}
  >
    {speaking ? <Square className="w-5 h-5" fill="currentColor" /> : <Volume2 className="w-6 h-6" />}
  </button>
)

export default SpeakButton
