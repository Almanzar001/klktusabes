import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle, FileText, Lightbulb, Loader2, Save, Sparkles, Trash2, Youtube } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { gameHelpers } from '../insforge'
import {
  AiAudience,
  AiDifficulty,
  AiProgress,
  AiQuestion,
  AiSource,
  MAX_MATERIAL_CHARS,
  generateTrivia,
  readPdfText
} from '../ai'

interface AiTriviaCreatorProps {
  // Recibe el id del juego recién guardado
  onSaved: (gameId: string) => void
  onCancel: () => void
}

type SourceKind = AiSource['kind']

const SOURCES: { id: SourceKind; label: string; hint: string; icon: React.ElementType }[] = [
  { id: 'tema', label: 'Un tema', hint: 'Escribe de qué quieres la trivia', icon: Lightbulb },
  { id: 'youtube', label: 'Un video de YouTube', hint: 'Pega el enlace y la IA lo ve', icon: Youtube },
  { id: 'pdf', label: 'Un PDF', hint: 'Sube el documento', icon: FileText }
]

const COUNTS = [5, 10, 15, 20, 30]
const TIMES = [15, 20, 30, 45, 60]

const AUDIENCES: { id: AiAudience; label: string }[] = [
  { id: 'ninos-pequenos', label: 'Niños de 5 a 7' },
  { id: 'ninos', label: 'Niños de 8 a 12' },
  { id: 'jovenes', label: 'Jóvenes' },
  { id: 'adultos', label: 'Adultos' }
]

const DIFFICULTIES: { id: AiDifficulty; label: string }[] = [
  { id: 'facil', label: 'Fácil' },
  { id: 'media', label: 'Media' },
  { id: 'dificil', label: 'Difícil' },
  { id: 'mezclada', label: 'De menos a más' }
]

const YOUTUBE_LINK = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)[A-Za-z0-9_-]{11}/

// Un PDF con menos texto que esto por página es, casi seguro, un escaneo
const MIN_CHARS_PER_PAGE = 40

interface ChipsProps<T> {
  options: { id: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

// Grupo de opciones para elegir una
function Chips<T extends string | number>({ options, value, onChange }: ChipsProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={option.id === value}
          className={`px-4 py-2 rounded-full border-2 text-sm font-bold transition-colors ${
            option.id === value
              ? 'bg-dominican-blue border-dominican-blue text-white'
              : 'bg-white border-gray-300 text-gray-700 hover:border-dominican-blue'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

const AiTriviaCreator: React.FC<AiTriviaCreatorProps> = ({ onSaved, onCancel }) => {
  const { user } = useAuth()

  // De dónde sale la trivia
  const [sourceKind, setSourceKind] = useState<SourceKind>('tema')
  const [topic, setTopic] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [focus, setFocus] = useState('')
  const [pdf, setPdf] = useState<{ name: string; pages: string[] } | null>(null)
  const [pdfReading, setPdfReading] = useState<string | null>(null)
  const [pdfFrom, setPdfFrom] = useState(1)
  const [pdfTo, setPdfTo] = useState(1)

  // Cómo se quiere
  const [count, setCount] = useState(10)
  const [audience, setAudience] = useState<AiAudience>('adultos')
  const [difficulty, setDifficulty] = useState<AiDifficulty>('media')
  const [timeLimit, setTimeLimit] = useState(30)
  const [readAloud, setReadAloud] = useState(false)
  const [instructions, setInstructions] = useState('')

  // Estado de la pantalla
  const [step, setStep] = useState<'form' | 'working' | 'review'>('form')
  const [progress, setProgress] = useState<AiProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const job = useRef<AbortController | null>(null)

  // Resultado, que se puede corregir antes de guardar
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<AiQuestion[]>([])
  const [warning, setWarning] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Si el juego ya se creó pero fallaron las preguntas, al reintentar no se crea otro
  const [savedGameId, setSavedGameId] = useState<string | null>(null)

  useEffect(() => () => job.current?.abort(), [])

  // Las trivias para los más pequeños se leen en voz alta, salvo que se decida otra cosa
  const handleAudience = (value: AiAudience) => {
    setAudience(value)
    setReadAloud(value === 'ninos-pequenos')
  }

  // --- PDF ---

  const handlePdfFile = async (file?: File) => {
    if (!file || pdfReading) return

    setError(null)
    setPdfReading('Abriendo el PDF…')
    try {
      const { pages } = await readPdfText(file, (page, total) => setPdfReading(`Leyendo página ${page} de ${total}…`))
      setPdf({ name: file.name, pages })
      setPdfFrom(1)
      setPdfTo(pages.length)
    } catch (err) {
      setPdf(null)
      setError(err instanceof Error ? err.message : 'No se pudo leer el PDF')
    } finally {
      setPdfReading(null)
    }
  }

  const pdfRange = pdf ? pdf.pages.slice(pdfFrom - 1, pdfTo) : []
  const pdfText = pdfRange.join('\n\n')
  const pdfScanned = !!pdf && pdfText.length < pdfRange.length * MIN_CHARS_PER_PAGE
  const pdfTooLong = pdfText.length > MAX_MATERIAL_CHARS

  const handlePdfRange = (from: number, to: number) => {
    if (!pdf) return
    const last = pdf.pages.length
    const start = Math.min(Math.max(1, from || 1), last)
    setPdfFrom(start)
    setPdfTo(Math.min(Math.max(start, to || start), last))
  }

  // --- Crear ---

  const source: AiSource | null =
    sourceKind === 'tema'
      ? topic.trim().length >= 3 ? { kind: 'tema', topic: topic.trim() } : null
      : sourceKind === 'youtube'
        ? YOUTUBE_LINK.test(youtubeUrl) ? { kind: 'youtube', url: youtubeUrl.trim(), focus: focus.trim() } : null
        : pdf && !pdfScanned && !pdfTooLong ? { kind: 'pdf', text: pdfText, focus: focus.trim() } : null

  const handleCreate = async () => {
    if (!source) return

    const controller = new AbortController()
    job.current = controller
    setError(null)
    setProgress(null)
    setStep('working')

    try {
      const trivia = await generateTrivia(source, { count, audience, difficulty, instructions: instructions.trim() }, setProgress, controller.signal)
      setTitle(trivia.title)
      setDescription(trivia.description)
      setQuestions(trivia.questions)
      setWarning(trivia.warning ?? null)
      setSavedGameId(null)
      setStep('review')
    } catch (err) {
      setStep('form')
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudo crear la trivia')
    }
  }

  const handleStop = () => {
    job.current?.abort()
    setStep('form')
  }

  // --- Revisar y guardar ---

  const updateQuestion = (index: number, changes: Partial<AiQuestion>) =>
    setQuestions(current => current.map((question, i) => (i === index ? { ...question, ...changes } : question)))

  const updateOption = (index: number, optionIndex: number, value: string) =>
    updateQuestion(index, { options: questions[index].options.map((option, i) => (i === optionIndex ? value : option)) })

  const canSave =
    !!title.trim() &&
    questions.length > 0 &&
    questions.every(question => question.text.trim() && question.options.every(option => option.trim()))

  const handleSave = async () => {
    if (!user || !canSave) return

    setSaving(true)
    setError(null)
    try {
      let gameId = savedGameId
      if (!gameId) {
        const { data, error: gameError } = await gameHelpers.createGame(title.trim(), description.trim(), user.id, readAloud)
        if (gameError || !data) {
          setError('No se pudo crear el juego. Inténtalo de nuevo.')
          return
        }
        gameId = data.id as string
        setSavedGameId(gameId)
      }

      const { error: questionsError } = await gameHelpers.addQuestions(
        gameId,
        questions.map((question, index) => ({
          text: question.text.trim(),
          options: question.options.map(option => option.trim()),
          correct_answer: question.correct_answer,
          time_limit: timeLimit,
          order_number: index + 1
        }))
      )
      if (questionsError) {
        setError('El juego se creó, pero no se pudieron guardar las preguntas. Vuelve a darle a Guardar.')
        return
      }

      onSaved(gameId)
    } catch (err) {
      console.error('Error guardando la trivia:', err)
      setError('Error inesperado al guardar la trivia')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen fondo-caribe">
      <div className="cabecera">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onCancel} className="text-white/85 hover:text-white" aria-label="Volver">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="font-display text-2xl text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6" />
              Crear trivia con IA
            </h1>
          </div>

          {step === 'review' && (
            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="btn-dominican-secondary py-2 px-4 text-base disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar trivia'}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="p-4 bg-dominican-red/10 border border-dominican-red/40 text-dominican-red rounded-lg">
            {error}
          </div>
        )}

        {step === 'form' && (
          <>
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-display text-dominican-blue mb-4">¿De dónde sale la trivia?</h2>

              <div className="grid sm:grid-cols-3 gap-3 mb-5">
                {SOURCES.map(({ id, label, hint, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSourceKind(id)}
                    aria-pressed={sourceKind === id}
                    className={`flex sm:flex-col items-center sm:text-center gap-3 sm:gap-1 p-4 rounded-xl border-2 transition-colors ${
                      sourceKind === id ? 'border-dominican-blue bg-arena' : 'border-gray-200 hover:border-dominican-blue/50'
                    }`}
                  >
                    <Icon className={`w-8 h-8 shrink-0 ${sourceKind === id ? 'text-dominican-blue' : 'text-gray-400'}`} />
                    <span className="text-left sm:text-center">
                      <span className="block font-bold text-dominican-blue-dark">{label}</span>
                      <span className="block text-xs text-gray-500">{hint}</span>
                    </span>
                  </button>
                ))}
              </div>

              {sourceKind === 'tema' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">¿Sobre qué quieres la trivia?</label>
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                    placeholder="Ej: La independencia dominicana, para un examen de 6to grado"
                    rows={3}
                    maxLength={500}
                  />
                </div>
              )}

              {sourceKind === 'youtube' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Enlace del video</label>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  {youtubeUrl.trim() && !YOUTUBE_LINK.test(youtubeUrl) && (
                    <p className="mt-2 text-sm font-semibold text-dominican-red">Ese enlace no parece de un video de YouTube.</p>
                  )}
                  <p className="mt-2 text-xs text-gray-500">El video tiene que ser público. Mientras más largo, más tarda la IA en verlo.</p>
                </div>
              )}

              {sourceKind === 'pdf' && (
                <div>
                  <label
                    className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed border-dominican-blue/30 rounded-lg px-4 py-6 text-center text-dominican-blue hover:bg-arena ${
                      pdfReading ? 'opacity-70' : 'cursor-pointer'
                    }`}
                  >
                    {pdfReading ? <Loader2 className="w-6 h-6 animate-spin" /> : <FileText className="w-6 h-6" />}
                    <span className="font-bold">{pdfReading ?? (pdf ? pdf.name : 'Elegir PDF')}</span>
                    <span className="text-xs text-gray-500">
                      {pdf && !pdfReading ? 'Toca para cambiarlo' : 'El documento se lee en tu dispositivo; a la IA solo se le envía el texto.'}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="sr-only"
                      disabled={!!pdfReading}
                      onChange={(e) => {
                        handlePdfFile(e.target.files?.[0])
                        e.target.value = ''
                      }}
                    />
                  </label>

                  {pdf && !pdfReading && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold text-gray-700">
                      <span>Usar de la página</span>
                      <input
                        type="number"
                        min={1}
                        max={pdf.pages.length}
                        value={pdfFrom}
                        onChange={(e) => handlePdfRange(Number(e.target.value), pdfTo)}
                        className="w-20 p-2 border border-gray-300 rounded-lg text-center"
                        aria-label="Primera página"
                      />
                      <span>a la</span>
                      <input
                        type="number"
                        min={pdfFrom}
                        max={pdf.pages.length}
                        value={pdfTo}
                        onChange={(e) => handlePdfRange(pdfFrom, Number(e.target.value))}
                        className="w-20 p-2 border border-gray-300 rounded-lg text-center"
                        aria-label="Última página"
                      />
                      <span className="font-normal text-gray-500">de {pdf.pages.length}</span>
                    </div>
                  )}

                  {pdfScanned && !pdfReading && (
                    <p className="mt-3 text-sm font-semibold text-dominican-red">
                      Esas páginas no tienen texto que se pueda leer: parece un PDF escaneado (fotos de las páginas). Por ahora solo sirven los PDF con texto.
                    </p>
                  )}
                  {pdfTooLong && !pdfReading && (
                    <p className="mt-3 text-sm font-semibold text-dominican-red">
                      Son demasiadas páginas para una sola trivia. Elige un tramo más corto, como un capítulo.
                    </p>
                  )}
                </div>
              )}

              {sourceKind !== 'tema' && (
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">¿En qué parte se debe centrar? (opcional)</label>
                  <input
                    type="text"
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                    placeholder="Ej: las fechas y los personajes"
                    maxLength={300}
                  />
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5">
              <h2 className="text-xl font-display text-dominican-blue">¿Cómo la quieres?</h2>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Cantidad de preguntas</p>
                <Chips options={COUNTS.map(value => ({ id: value, label: String(value) }))} value={count} onChange={setCount} />
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">¿Para quién es?</p>
                <Chips options={AUDIENCES} value={audience} onChange={handleAudience} />
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Dificultad</p>
                <Chips options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Segundos para responder cada pregunta</p>
                <Chips options={TIMES.map(value => ({ id: value, label: String(value) }))} value={timeLimit} onChange={setTimeLimit} />
              </div>

              <label className="flex items-start gap-3 p-3 bg-arena border border-dominican-blue/20 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={readAloud}
                  onChange={(e) => setReadAloud(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-dominican-blue"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-700">Leer las preguntas en voz alta</span>
                  <span className="block text-xs text-gray-500">Para niños que aún no leen: la app lee cada pregunta y sus respuestas.</span>
                </span>
              </label>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Algo más que deba tener en cuenta (opcional)</label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                  placeholder="Ej: que haya preguntas de fechas, o que las respuestas sean muy cortas"
                  rows={2}
                  maxLength={500}
                />
              </div>
            </div>

            <button onClick={handleCreate} disabled={!source} className="btn-dominican-primary w-full disabled:opacity-50">
              <Sparkles className="w-5 h-5 mr-2" />
              Crear trivia
            </button>
            <p className="text-center text-xs text-gray-500">
              La IA puede equivocarse. Antes de guardar vas a poder revisar y corregir cada pregunta.
            </p>
          </>
        )}

        {step === 'working' && (
          <div className="bg-white rounded-2xl shadow-lg p-10 text-center space-y-5">
            <Loader2 className="w-12 h-12 mx-auto text-dominican-blue animate-spin" />
            <p className="font-display text-2xl text-dominican-blue">
              {progress?.stage === 'questions'
                ? `Escribiendo las preguntas… ${progress.done} de ${progress.total}`
                : sourceKind === 'youtube' ? 'Viendo el video…' : 'Preparando la trivia…'}
            </p>
            <div className="h-3 max-w-md mx-auto bg-dominican-blue/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-dominican-red rounded-full transition-[width] duration-500"
                style={{ width: `${progress?.stage === 'questions' ? Math.max(6, (progress.done / progress.total) * 100) : 6}%` }}
              />
            </div>
            <p className="text-sm text-gray-500">Puede tardar un minuto o dos. No cierres esta pantalla.</p>
            <button onClick={handleStop} className="btn-dominican-outline py-2 px-5 text-base">
              Cancelar
            </button>
          </div>
        )}

        {step === 'review' && (
          <>
            {warning && (
              <div className="p-4 bg-ambar/15 border border-ambar/50 text-dominican-blue-dark rounded-lg">{warning}</div>
            )}

            <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Revisa las preguntas antes de guardar: puedes corregir los textos, cambiar cuál es la respuesta correcta o borrar las que no te gusten.
              </p>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Título del juego *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                  rows={2}
                  maxLength={300}
                />
              </div>
            </div>

            {questions.map((question, index) => (
              <div key={index} className="bg-white rounded-2xl shadow-lg p-5">
                <div className="flex items-start gap-3 mb-3">
                  <span className="bg-dominican-blue text-white text-sm font-bold px-2 py-1 rounded shrink-0">#{index + 1}</span>
                  <textarea
                    value={question.text}
                    onChange={(e) => updateQuestion(index, { text: e.target.value })}
                    className="flex-1 p-2 border border-gray-300 rounded-lg font-semibold text-dominican-blue-dark focus:outline-none focus:ring-2 focus:ring-dominican-blue"
                    rows={2}
                    maxLength={500}
                    aria-label={`Pregunta ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => setQuestions(current => current.filter((_, i) => i !== index))}
                    className="p-2 text-dominican-red hover:bg-dominican-red/10 rounded-lg"
                    title="Borrar esta pregunta"
                    aria-label={`Borrar la pregunta ${index + 1}`}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-2">
                  {question.options.map((option, optionIndex) => {
                    const isCorrect = optionIndex === question.correct_answer
                    return (
                      <div key={optionIndex} className="flex gap-2">
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                          className={`flex-1 min-w-0 p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dominican-blue ${
                            isCorrect ? 'border-palma/40 bg-palma/10' : 'border-gray-300'
                          }`}
                          maxLength={200}
                          aria-label={`Respuesta ${optionIndex + 1} de la pregunta ${index + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => updateQuestion(index, { correct_answer: optionIndex })}
                          className={`p-2 rounded-lg transition-colors ${
                            isCorrect ? 'bg-palma text-white' : 'bg-gray-200 text-gray-600 hover:bg-green-200'
                          }`}
                          title="Marcar como respuesta correcta"
                          aria-pressed={isCorrect}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>

                {question.explanation && (
                  <p className="mt-3 text-xs text-gray-500">
                    <span className="font-semibold">Por qué:</span> {question.explanation}
                  </p>
                )}
              </div>
            ))}

            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={handleSave} disabled={!canSave || saving} className="btn-dominican-primary flex-1 disabled:opacity-50">
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Guardando...' : `Guardar trivia (${questions.length} ${questions.length === 1 ? 'pregunta' : 'preguntas'})`}
              </button>
              <button onClick={() => setStep('form')} disabled={saving} className="btn-dominican-outline flex-1">
                Volver a empezar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default AiTriviaCreator
