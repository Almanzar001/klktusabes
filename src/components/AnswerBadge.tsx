import React from 'react'

export type AnswerIcon = 'pelota' | 'domino' | 'tambora' | 'palma'

// Las cuatro respuestas del juego: un color y un símbolo dominicano cada una
export const ANSWER_STYLES: { bg: string; text: string; icon: AnswerIcon }[] = [
  { bg: 'bg-dominican-red', text: 'text-dominican-red', icon: 'pelota' },
  { bg: 'bg-larimar', text: 'text-larimar', icon: 'domino' },
  { bg: 'bg-ambar', text: 'text-ambar', icon: 'tambora' },
  { bg: 'bg-palma', text: 'text-palma', icon: 'palma' }
]

interface AnswerBadgeProps {
  icon: AnswerIcon
  color: string // clase de color de texto de la respuesta
  className?: string
}

// Símbolo de cada respuesta sobre una ficha blanca: pelota de béisbol, ficha de
// dominó, tambora y palma. Se dibuja con el color de su respuesta.
const AnswerBadge: React.FC<AnswerBadgeProps> = ({ icon, color, className = 'w-9 h-9' }) => (
  <span className={`${className} ${color} shrink-0 rounded-full bg-white shadow flex items-center justify-center`}>
    <svg viewBox="0 0 24 24" className="w-[68%] h-[68%]" aria-hidden="true">
      {icon === 'pelota' && (
        <>
          <circle cx="12" cy="12" r="10" fill="currentColor" />
          <path d="M6.2 4.6 C9.2 8.6 9.2 15.4 6.2 19.4 M17.8 4.6 C14.8 8.6 14.8 15.4 17.8 19.4" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </>
      )}
      {icon === 'domino' && (
        <>
          <rect x="5" y="1.5" width="14" height="21" rx="3" fill="currentColor" />
          <path d="M7.5 12 H16.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
          <g fill="#fff">
            <circle cx="9.3" cy="5" r="1.3" />
            <circle cx="14.7" cy="8.6" r="1.3" />
            <circle cx="9.3" cy="15.2" r="1.3" />
            <circle cx="12" cy="17.4" r="1.3" />
            <circle cx="14.7" cy="19.6" r="1.3" />
          </g>
        </>
      )}
      {icon === 'tambora' && (
        <>
          <path d="M4.5 7 V16.5 C4.5 19 7.9 21 12 21 S19.5 19 19.5 16.5 V7 Z" fill="currentColor" />
          <path d="M5.5 10 L8.6 18.6 L12 10.8 L15.4 18.6 L18.5 10" stroke="#fff" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
          <ellipse cx="12" cy="7" rx="7.5" ry="3.4" fill="currentColor" stroke="#fff" strokeWidth="1.4" />
        </>
      )}
      {icon === 'palma' && (
        <g fill="currentColor">
          <path d="M10.6 22.5 C10.9 18 11.5 14 12.6 10.5 L14.2 11 C13.3 14.5 13 18.3 13.2 22.5 Z" />
          <path d="M13 10.5 C10 6.6 6.2 5.8 2.6 8.4 C6.6 7.8 10 8.6 13 10.5 Z" />
          <path d="M13 10.5 C16 6.6 19.8 5.8 23 8.6 C19.2 7.8 16 8.6 13 10.5 Z" />
          <path d="M13 10.5 C11.6 6 9 3.2 5.4 2.4 C8.4 4.6 10.8 7 13 10.5 Z" />
          <path d="M13 10.5 C14.4 6 17 3.2 20.6 2.4 C17.6 4.6 15.2 7 13 10.5 Z" />
          <path d="M13 10.5 C10 10.8 7.4 12.8 6 16.4 C8.6 13.6 10.8 11.8 13 10.5 Z" />
          <path d="M13 10.5 C16 10.8 18.6 12.8 20 16.4 C17.4 13.6 15.2 11.8 13 10.5 Z" />
        </g>
      )}
    </svg>
  </span>
)

export default AnswerBadge
