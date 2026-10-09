import React from 'react'
import AnswerBadge, { ANSWER_STYLES } from './AnswerBadge'

interface AnswerTileProps {
  // Lugar que ocupa en pantalla: decide el color y el símbolo
  position: number
  text: string
  imageUrl?: string | null
  onClick: () => void
  disabled?: boolean
  // Clases según el estado de la ficha: elegida, apagada, etc.
  className?: string
  // La app está leyendo esta respuesta en voz alta: se resalta para que se sepa cuál es
  speaking?: boolean
  // Marcas que van encima de la ficha
  children?: React.ReactNode
}

// Rejilla de las fichas. Cuando las cuatro respuestas son solo imágenes (como
// en un test de figuras) caben en una fila en pantallas anchas, y así queda
// sitio para ver grande la imagen de la pregunta.
export const answerGridClass = (imagesOnly: boolean) =>
  imagesOnly
    ? 'grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3'
    : 'grid grid-cols-2 auto-rows-fr gap-3 flex-1 max-h-[30rem] mt-auto'

// Ficha de una respuesta durante la partida. Si la respuesta tiene imagen, la
// muestra sobre blanco para que una figura se vea igual en cualquier color.
const AnswerTile: React.FC<AnswerTileProps> = ({ position, text, imageUrl, onClick, disabled, className = '', speaking = false, children }) => {
  const style = ANSWER_STYLES[position]

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${style.bg} tablita relative flex items-center rounded-2xl border-4 border-white text-white font-bold shadow-lg transition-all ${
        imageUrl
          ? 'flex-col justify-center gap-1.5 p-2 text-center text-sm sm:text-xl'
          : 'flex-col sm:flex-row justify-center sm:justify-start gap-2 sm:gap-4 px-3 sm:px-5 py-4 min-h-[6rem] text-center sm:text-left text-base sm:text-2xl'
      } ${speaking ? 'ring-8 ring-yellow-300 scale-[1.04] brightness-110 z-10' : ''} ${className}`}
    >
      {imageUrl ? (
        <>
          {/* el símbolo va al lado, no encima: no debe tapar ninguna parte de la figura */}
          <span className="flex items-center gap-1.5 sm:gap-2 w-full">
            <AnswerBadge icon={style.icon} color={style.text} className="w-7 h-7 sm:w-8 sm:h-8" />
            <span className="relative block flex-1 aspect-square rounded-xl bg-white overflow-hidden">
              <img
                src={imageUrl}
                alt={text || `Respuesta ${position + 1}`}
                className="absolute inset-0 w-full h-full object-contain p-1"
              />
            </span>
          </span>
          {text && <span className="break-words max-w-full">{text}</span>}
        </>
      ) : (
        <>
          <AnswerBadge icon={style.icon} color={style.text} className="w-12 h-12 sm:w-14 sm:h-14" />
          <span className="break-words">{text}</span>
        </>
      )}
      {children}
    </button>
  )
}

interface AnswerThumbnailProps {
  imageUrl?: string | null
  className?: string
}

// Miniatura de la imagen de una respuesta, para listas y resúmenes
export const AnswerThumbnail: React.FC<AnswerThumbnailProps> = ({ imageUrl, className = 'h-10 w-14 sm:h-14 sm:w-20' }) =>
  imageUrl ? (
    <img src={imageUrl} alt="" className={`${className} shrink-0 rounded-md bg-white object-contain`} />
  ) : null

export default AnswerTile
