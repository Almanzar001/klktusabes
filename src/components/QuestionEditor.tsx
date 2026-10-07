import React, { useState, useEffect, useRef } from 'react'
import { Save, X, Image as ImageIcon, Clock, CheckCircle, Loader2, Music, Trash2, Upload } from 'lucide-react'
import { gameHelpers, mediaHelpers } from '../insforge'
import { Game, Question, DEFAULT_QUESTION_TIME } from '../types'
import {
  AUDIO_MAX_SECONDS,
  DecodedAudio,
  OptimizedAudio,
  OptimizedImage,
  decodeAudio,
  encodeAudioClip,
  formatBytes,
  formatSeconds,
  optimizeImage
} from '../media'

interface QuestionEditorProps {
  game: Game
  question?: Question | null
  onSave: () => void
  onCancel: () => void
}

// Archivo que la pregunta ya tenía guardado
interface SavedMedia {
  url: string
  key: string | null
}

// Archivo recién elegido: ya optimizado, se sube al guardar la pregunta
type ImageDraft = OptimizedImage & { previewUrl: string }
type AudioDraft = OptimizedAudio & { previewUrl: string }

// Resumen del ahorro, por ejemplo "4.8 MB → 356 KB"
const savingsLabel = (originalBytes: number, bytes: number) =>
  bytes < originalBytes ? `${formatBytes(originalBytes)} → ${formatBytes(bytes)}` : formatBytes(bytes)

const QuestionEditor: React.FC<QuestionEditorProps> = ({
  game,
  question,
  onSave,
  onCancel
}) => {
  // Estados del formulario
  const [questionText, setQuestionText] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [correctAnswer, setCorrectAnswer] = useState(0)
  const [timeLimit, setTimeLimit] = useState(DEFAULT_QUESTION_TIME)

  // Imagen y sonido de la pregunta
  const [savedImage, setSavedImage] = useState<SavedMedia | null>(null)
  const [imageDraft, setImageDraft] = useState<ImageDraft | null>(null)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [savedAudio, setSavedAudio] = useState<SavedMedia | null>(null)
  const [audioDraft, setAudioDraft] = useState<AudioDraft | null>(null)
  const [audioBusy, setAudioBusy] = useState(false)
  const [audioProgress, setAudioProgress] = useState(0)
  const [audioError, setAudioError] = useState<string | null>(null)
  // Audio original ya leído, para poder elegir otro fragmento sin volver a abrirlo
  const [audioSource, setAudioSource] = useState<DecodedAudio | null>(null)
  const [audioStart, setAudioStart] = useState(0)
  const audioJob = useRef<AbortController | null>(null)
  const audioStartTimer = useRef<number>()
  const audioPreviewUrl = useRef<string>()
  const previewUrls = useRef(new Set<string>())

  // Estados de la UI
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Cargar datos si estamos editando una pregunta existente
  useEffect(() => {
    if (question) {
      setQuestionText(question.text)
      setOptions(question.options)
      setCorrectAnswer(question.correct_answer)
      setTimeLimit(question.time_limit)
      setSavedImage(question.image_url ? { url: question.image_url, key: question.image_key ?? null } : null)
      setSavedAudio(question.audio_url ? { url: question.audio_url, key: question.audio_key ?? null } : null)
    }
  }, [question])

  // Las vistas previas locales ocupan memoria hasta que se sueltan
  const createPreviewUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    previewUrls.current.add(url)
    return url
  }

  const releasePreviewUrl = (url?: string) => {
    if (!url) return
    URL.revokeObjectURL(url)
    previewUrls.current.delete(url)
  }

  useEffect(() => {
    const urls = previewUrls.current
    return () => {
      audioJob.current?.abort()
      window.clearTimeout(audioStartTimer.current)
      urls.forEach(url => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  const imageSrc = imageDraft?.previewUrl ?? savedImage?.url ?? null
  const audioSrc = audioDraft?.previewUrl ?? savedAudio?.url ?? null
  const mediaBusy = imageBusy || audioBusy

  // Elegir imagen: se optimiza al momento y se sube al guardar
  const handleImageFile = async (file?: File) => {
    if (!file || imageBusy) return

    setImageBusy(true)
    setImageError(null)
    try {
      const optimized = await optimizeImage(file)
      releasePreviewUrl(imageDraft?.previewUrl)
      setImageDraft({ ...optimized, previewUrl: createPreviewUrl(optimized.blob) })
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'No se pudo procesar la imagen')
    } finally {
      setImageBusy(false)
    }
  }

  const handleRemoveImage = () => {
    releasePreviewUrl(imageDraft?.previewUrl)
    setImageDraft(null)
    setSavedImage(null)
    setImageError(null)
  }

  // Comprime el fragmento del audio que empieza en `start`
  const compressAudio = async (source: DecodedAudio, start: number) => {
    audioJob.current?.abort()
    const job = new AbortController()
    audioJob.current = job

    setAudioBusy(true)
    setAudioProgress(0)
    setAudioError(null)
    try {
      const optimized = await encodeAudioClip(source, start, {
        signal: job.signal,
        onProgress: fraction => {
          if (!job.signal.aborted) setAudioProgress(fraction)
        }
      })
      if (job.signal.aborted) return
      releasePreviewUrl(audioPreviewUrl.current)
      audioPreviewUrl.current = createPreviewUrl(optimized.blob)
      setAudioDraft({ ...optimized, previewUrl: audioPreviewUrl.current })
    } catch (err) {
      if (job.signal.aborted) return
      setAudioError(err instanceof Error ? err.message : 'No se pudo procesar el audio')
    } finally {
      if (audioJob.current === job) setAudioBusy(false)
    }
  }

  const handleAudioFile = async (file?: File) => {
    if (!file || audioBusy) return

    setAudioBusy(true)
    setAudioProgress(0)
    setAudioError(null)
    try {
      const source = await decodeAudio(file)
      setAudioSource(source)
      setAudioStart(0)
      await compressAudio(source, 0)
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'No se pudo procesar el audio')
      setAudioBusy(false)
    }
  }

  // Mover el inicio del fragmento: se vuelve a comprimir al soltar el control
  const handleAudioStartChange = (start: number) => {
    setAudioStart(start)
    window.clearTimeout(audioStartTimer.current)
    audioStartTimer.current = window.setTimeout(() => {
      if (audioSource) compressAudio(audioSource, start)
    }, 350)
  }

  const handleRemoveAudio = () => {
    audioJob.current?.abort()
    window.clearTimeout(audioStartTimer.current)
    releasePreviewUrl(audioPreviewUrl.current)
    audioPreviewUrl.current = undefined
    setAudioDraft(null)
    setSavedAudio(null)
    setAudioSource(null)
    setAudioStart(0)
    setAudioBusy(false)
    setAudioError(null)
  }

  // Validar formulario
  const isFormValid = () => {
    if (!questionText.trim()) return false
    if (options.some(option => !option.trim())) return false
    if (correctAnswer < 0 || correctAnswer > 3) return false
    if (timeLimit < 5 || timeLimit > 120) return false
    return true
  }

  // Manejar cambio en opciones
  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }


  // Guardar pregunta
  const handleSave = async () => {
    if (!isFormValid()) {
      setError('Por favor completa todos los campos correctamente')
      return
    }

    // Archivos subidos en este intento: si la pregunta no se guarda, se borran
    const uploadedKeys: string[] = []
    let saved = false

    try {
      setSaving(true)
      setError(null)


      // Verificar que tenemos un game ID válido
      if (!game?.id) {
        setError('Error: No se encontró el ID del juego')
        return
      }

      // Subir la imagen y el sonido nuevos
      let image = savedImage
      if (imageDraft) {
        const { data, error } = await mediaHelpers.upload(game.id, 'imagen', imageDraft.blob, imageDraft.extension)
        if (error || !data) {
          setError(`No se pudo subir la imagen: ${error?.message || 'error desconocido'}`)
          return
        }
        uploadedKeys.push(data.key)
        image = data
      }

      let audio = savedAudio
      if (audioDraft) {
        const { data, error } = await mediaHelpers.upload(game.id, 'sonido', audioDraft.blob, audioDraft.extension)
        if (error || !data) {
          setError(`No se pudo subir el sonido: ${error?.message || 'error desconocido'}`)
          return
        }
        uploadedKeys.push(data.key)
        audio = data
      }

      // Obtener el número de orden para la nueva pregunta
      const orderNumber = question?.order_number || (game.questions?.length || 0) + 1

      const questionData = {
        text: questionText.trim(),
        options: options.map(opt => opt.trim()),
        correct_answer: correctAnswer,
        time_limit: timeLimit,
        order_number: orderNumber,
        image_url: image?.url ?? null,
        image_key: image?.key ?? null,
        audio_url: audio?.url ?? null,
        audio_key: audio?.key ?? null
      }


      if (question) {
        // Actualizar pregunta existente
        const { error } = await gameHelpers.updateQuestion(question.id, questionData)
        
        if (error) {
          
          // Mostrar error más específico
          let errorMessage = 'Error al actualizar la pregunta'
          
          if (error && typeof error === 'object' && 'code' in error && error.code === 'TIMEOUT') {
            errorMessage = 'La operación tardó demasiado tiempo. Posibles causas:\n• Problemas de conexión a internet\n• Configuración incorrecta de InsForge\n• Problemas con los permisos de la base de datos'
          } else if (typeof error === 'object' && error.message) {
            errorMessage += `: ${error.message}`
          } else if (typeof error === 'string') {
            errorMessage += `: ${error}`
          }
          
          // Errores comunes específicos
          if (error.message?.includes('RLS') || error.message?.includes('policy')) {
            errorMessage = 'Error de permisos: No tienes autorización para editar esta pregunta. Contacta al administrador.'
          } else if (error.message?.includes('not found') || error.message?.includes('404')) {
            errorMessage = 'Error: La pregunta no existe o ya fue eliminada'
          } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
            errorMessage = 'Error de conexión: Verifica tu conexión a internet'
          }
          
          setError(errorMessage)
          console.error('🔴 Error completo:', error)
          return
        }

      } else {
        // Crear nueva pregunta
        const { error } = await gameHelpers.addQuestion(game.id, questionData)
        
        if (error) {
          
          // Mostrar error más específico
          let errorMessage = 'Error al guardar la pregunta'
          
          if (error && typeof error === 'object' && 'code' in error && error.code === 'TIMEOUT') {
            errorMessage = 'La operación tardó demasiado tiempo. Posibles causas:\n• Problemas de conexión a internet\n• Configuración incorrecta de InsForge\n• Problemas con los permisos de la base de datos'
          } else if (typeof error === 'object' && error.message) {
            errorMessage += `: ${error.message}`
          } else if (typeof error === 'string') {
            errorMessage += `: ${error}`
          }
          
          // Errores comunes específicos
          if (error.message?.includes('RLS') || error.message?.includes('policy')) {
            errorMessage = 'Error de permisos: No tienes autorización para crear preguntas en este juego. Contacta al administrador.'
          } else if (error.message?.includes('duplicate')) {
            errorMessage = 'Error: Ya existe una pregunta con ese número de orden'
          } else if (error.message?.includes('foreign key')) {
            errorMessage = 'Error: El juego no existe o no tienes acceso a él'
          } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
            errorMessage = 'Error de conexión: Verifica tu conexión a internet'
          }
          
          setError(errorMessage)
          console.error('🔴 Error completo:', error)
          return
        }

      }

      saved = true

      // Los archivos que la pregunta tenía antes y ya no usa sobran
      await mediaHelpers.remove([
        question?.image_key !== image?.key ? question?.image_key : null,
        question?.audio_key !== audio?.key ? question?.audio_key : null
      ])

      onSave()
    } catch (err) {
      console.error('Error guardando pregunta:', err)
      setError(`Error inesperado al guardar la pregunta: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    } finally {
      if (!saved) await mediaHelpers.remove(uploadedKeys)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen fondo-caribe">
      {/* Header */}
      <div className="cabecera">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl text-white">
                {question ? 'Editar Pregunta' : 'Nueva Pregunta'}
              </h1>
              <p className="text-sm font-semibold text-white/80">
                Juego: {game.title}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="btn-dominican-outline text-base py-2 px-4"
              >
                {showPreview ? 'Editar' : 'Vista Previa'}
              </button>
              
              <button
                onClick={handleSave}
                disabled={!isFormValid() || saving || mediaBusy}
                className="btn-dominican-secondary py-2 px-4 text-base disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              
              <button
                onClick={onCancel}
                className="text-white/85 hover:text-white p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Mensaje de error */}
        {error && (
          <div className="mb-6 p-4 bg-dominican-red/10 border border-dominican-red/40 text-dominican-red rounded-lg">
            {error}
          </div>
        )}

        {showPreview ? (
          // Vista previa de la pregunta
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="question-card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display text-dominican-blue">Vista Previa</h2>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-5 h-5" />
                  <span>{timeLimit}s</span>
                </div>
              </div>
              
              {imageSrc && (
                <div className="mb-6">
                  <img
                    src={imageSrc}
                    alt="Imagen de la pregunta"
                    className="max-w-full max-h-64 object-contain rounded-lg mx-auto"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              )}

              {audioSrc && (
                <audio src={audioSrc} controls preload="metadata" className="w-full mb-6" />
              )}
              
              <h3 className="text-xl font-semibold text-dominican-blue-dark mb-8">
                {questionText || 'Escribe tu pregunta aquí...'}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {options.map((option, index) => (
                  <button
                    key={index}
                    className={`answer-option ${
                      index === correctAnswer ? 'answer-option-correct' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option || `Opción ${index + 1}`}</span>
                      {index === correctAnswer && (
                        <CheckCircle className="w-5 h-5 text-palma" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Formulario de edición
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Formulario principal */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-display text-dominican-blue mb-6">
                Contenido de la Pregunta
              </h2>
              
              <div className="space-y-6">
                {/* Texto de la pregunta */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Pregunta *
                  </label>
                  <textarea
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                    placeholder="¿Cuál es la capital de República Dominicana?"
                    rows={3}
                    maxLength={500}
                  />
                  <div className="text-right text-xs text-gray-500 mt-1">
                    {questionText.length}/500
                  </div>
                </div>

                {/* Imagen opcional */}
                <div>
                  <p className="block text-sm font-semibold text-gray-700 mb-2">
                    <ImageIcon className="w-4 h-4 inline mr-1" />
                    Imagen (opcional)
                  </p>

                  {imageSrc ? (
                    <div className="border border-gray-200 rounded-lg p-3 bg-arena/60">
                      <img
                        src={imageSrc}
                        alt="Imagen de la pregunta"
                        className="max-h-48 max-w-full mx-auto rounded-lg object-contain"
                      />
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-600">
                          {imageDraft ? (
                            <>
                              <span className="text-palma">Optimizada</span>
                              {' · '}
                              {savingsLabel(imageDraft.originalBytes, imageDraft.bytes)}
                              {' · '}
                              {imageDraft.width}×{imageDraft.height} px
                            </>
                          ) : (
                            'Imagen guardada'
                          )}
                        </p>
                        <div className="flex items-center gap-3">
                          <label className={`text-sm font-bold text-dominican-blue hover:underline ${imageBusy ? 'opacity-50' : 'cursor-pointer'}`}>
                            {imageBusy ? 'Optimizando…' : 'Cambiar'}
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              disabled={imageBusy}
                              onChange={(e) => {
                                handleImageFile(e.target.files?.[0])
                                e.target.value = ''
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="flex items-center gap-1 text-sm font-bold text-dominican-red hover:underline"
                          >
                            <Trash2 className="w-4 h-4" />
                            Quitar
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label
                      className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed border-dominican-blue/30 rounded-lg px-4 py-6 text-center text-dominican-blue hover:bg-arena ${
                        imageBusy ? 'opacity-70' : 'cursor-pointer'
                      }`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        handleImageFile(e.dataTransfer.files?.[0])
                      }}
                    >
                      {imageBusy ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                      <span className="font-bold">{imageBusy ? 'Optimizando imagen…' : 'Subir imagen'}</span>
                      <span className="text-xs text-gray-500">
                        JPG, PNG o WebP. Se comprime sola para que pese poco y se vea bien.
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={imageBusy}
                        onChange={(e) => {
                          handleImageFile(e.target.files?.[0])
                          e.target.value = ''
                        }}
                      />
                    </label>
                  )}

                  {imageError && (
                    <p className="mt-2 text-sm font-semibold text-dominican-red">{imageError}</p>
                  )}
                </div>

                {/* Sonido opcional */}
                <div>
                  <p className="block text-sm font-semibold text-gray-700 mb-2">
                    <Music className="w-4 h-4 inline mr-1" />
                    Sonido (opcional)
                  </p>

                  {audioSrc || audioSource ? (
                    <div className="border border-gray-200 rounded-lg p-3 bg-arena/60">
                      {audioSrc && (
                        <audio src={audioSrc} controls preload="metadata" className="w-full" />
                      )}

                      {audioSource && audioSource.duration > AUDIO_MAX_SECONDS && (
                        <div className="mt-3">
                          <label className="flex items-center justify-between text-xs font-semibold text-gray-600">
                            <span>Empieza en {formatSeconds(audioStart)}</span>
                            <span>Se usan {AUDIO_MAX_SECONDS} s de {formatSeconds(audioSource.duration)}</span>
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={Math.floor(audioSource.duration - AUDIO_MAX_SECONDS)}
                            step={1}
                            value={audioStart}
                            onChange={(e) => handleAudioStartChange(Number(e.target.value))}
                            className="w-full accent-dominican-blue"
                            aria-label="Segundo en el que empieza el sonido"
                          />
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-600">
                          {audioBusy ? (
                            <span className="inline-flex items-center gap-1 text-dominican-blue">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Comprimiendo… {Math.round(audioProgress * 100)}%
                            </span>
                          ) : audioDraft ? (
                            <>
                              <span className="text-palma">Optimizado</span>
                              {' · '}
                              {savingsLabel(audioDraft.originalBytes, audioDraft.bytes)}
                              {' · '}
                              {formatSeconds(audioDraft.duration)}
                            </>
                          ) : (
                            'Sonido guardado'
                          )}
                        </p>
                        <div className="flex items-center gap-3">
                          <label className={`text-sm font-bold text-dominican-blue hover:underline ${audioBusy ? 'opacity-50' : 'cursor-pointer'}`}>
                            Cambiar
                            <input
                              type="file"
                              accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.opus"
                              className="sr-only"
                              disabled={audioBusy}
                              onChange={(e) => {
                                handleAudioFile(e.target.files?.[0])
                                e.target.value = ''
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={handleRemoveAudio}
                            className="flex items-center gap-1 text-sm font-bold text-dominican-red hover:underline"
                          >
                            <Trash2 className="w-4 h-4" />
                            Quitar
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label
                      className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed border-dominican-blue/30 rounded-lg px-4 py-6 text-center text-dominican-blue hover:bg-arena ${
                        audioBusy ? 'opacity-70' : 'cursor-pointer'
                      }`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        handleAudioFile(e.dataTransfer.files?.[0])
                      }}
                    >
                      {audioBusy ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                      <span className="font-bold">{audioBusy ? 'Leyendo el audio…' : 'Subir sonido'}</span>
                      <span className="text-xs text-gray-500">
                        MP3, M4A o WAV. Se usan hasta {AUDIO_MAX_SECONDS} segundos y se comprime solo para que pese poco y se oiga bien.
                      </span>
                      <input
                        type="file"
                        accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.opus"
                        className="sr-only"
                        disabled={audioBusy}
                        onChange={(e) => {
                          handleAudioFile(e.target.files?.[0])
                          e.target.value = ''
                        }}
                      />
                    </label>
                  )}

                  {audioError && (
                    <p className="mt-2 text-sm font-semibold text-dominican-red">{audioError}</p>
                  )}
                </div>

                {/* Tiempo límite */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Tiempo Límite (segundos) *
                  </label>
                  <input
                    type="number"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                    min="5"
                    max="120"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Entre 5 y 120 segundos
                  </p>
                </div>
              </div>
            </div>

            {/* Opciones de respuesta */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-display text-dominican-blue mb-6">
                Opciones de Respuesta
              </h2>
              
              <div className="space-y-4">
                {options.map((option, index) => (
                  <div key={index} className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Opción {index + 1} *
                      {index === correctAnswer && (
                        <span className="ml-2 text-palma font-normal">
                          (Respuesta Correcta)
                        </span>
                      )}
                    </label>
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        className={`flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue ${
                          index === correctAnswer
                            ? 'border-palma/40 bg-palma/10'
                            : 'border-gray-300'
                        }`}
                        placeholder={`Escribe la opción ${index + 1}...`}
                        maxLength={200}
                      />
                      
                      <button
                        onClick={() => setCorrectAnswer(index)}
                        className={`p-3 rounded-lg transition-colors ${
                          index === correctAnswer
                            ? 'bg-palma text-white'
                            : 'bg-gray-200 text-gray-600 hover:bg-green-200'
                        }`}
                        title="Marcar como respuesta correcta"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div className="text-right text-xs text-gray-500 mt-1">
                      {option.length}/200
                    </div>
                  </div>
                ))}
              </div>

              {/* Instrucciones */}
              <div className="mt-6 p-4 bg-arena border border-dominican-blue/20 rounded-lg">
                <h3 className="font-semibold text-dominican-blue mb-2">
                  💡 Consejos para crear buenas preguntas:
                </h3>
                <ul className="text-sm text-dominican-blue space-y-1">
                  <li>• Haz preguntas claras y específicas</li>
                  <li>• Asegúrate de que solo una respuesta sea correcta</li>
                  <li>• Evita opciones obviamente incorrectas</li>
                  <li>• Usa un lenguaje apropiado para tu audiencia</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Botones de acción en móvil */}
        <div className="lg:hidden mt-8 flex gap-3">
          <button
            onClick={handleSave}
            disabled={!isFormValid() || saving || mediaBusy}
            className="btn-dominican-primary flex-1 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          
          <button
            onClick={onCancel}
            className="btn-dominican-outline flex-1"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default QuestionEditor