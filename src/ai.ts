// Creación de trivias con IA: llama a la función `generate-trivia` del backend
// y lee el texto de los PDF en el propio navegador.
import { insforge } from './insforge'

export type AiAudience = 'ninos-pequenos' | 'ninos' | 'jovenes' | 'adultos'
export type AiDifficulty = 'facil' | 'media' | 'dificil' | 'mezclada'

export type AiSource =
  | { kind: 'tema'; topic: string }
  | { kind: 'youtube'; url: string; focus: string }
  | { kind: 'pdf'; text: string; focus: string }

export interface AiOptions {
  count: number
  audience: AiAudience
  difficulty: AiDifficulty
  instructions: string
}

export interface AiQuestion {
  text: string
  options: string[]
  correct_answer: number
  // Por qué es correcta: sirve para revisar la pregunta, no se guarda
  explanation: string
}

export interface AiTrivia {
  title: string
  description: string
  questions: AiQuestion[]
  // Aviso cuando no se llegó a la cantidad pedida
  warning?: string
}

export interface AiProgress {
  stage: 'video' | 'questions'
  done: number
  total: number
}

// El modelo escribe las preguntas por tandas: así cada llamada es corta y se va viendo el avance
const BATCH_SIZE = 10
// Lo que acepta la función como material de una trivia
export const MAX_MATERIAL_CHARS = 200_000

// La función vive en el host de funciones del proyecto: https://{app}.function2.insforge.app
const functionUrl = (slug: string) => {
  const baseUrl: string = (import.meta as any).env.VITE_INSFORGE_URL
  try {
    const { hostname } = new URL(baseUrl)
    if (hostname.endsWith('.insforge.app')) return `https://${hostname.split('.')[0]}.function2.insforge.app/${slug}`
  } catch {
    // se usa la ruta del backend
  }
  return `${baseUrl}/functions/${slug}`
}

// Se llama con fetch y no con el SDK porque una tanda puede tardar más de los
// 30 segundos que el SDK espera antes de cortar
const callGenerator = async <T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> => {
  const token = await insforge.getHttpClient().getValidAccessToken()
  if (!token) throw new Error('Inicia sesión para usar la IA')

  let response: Response
  try {
    response = await fetch(functionUrl('generate-trivia'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new Error('No se pudo conectar con la IA. Revisa tu conexión.')
  }

  const result = await response.json().catch(() => null)
  if (!result?.ok) throw new Error(result?.error || 'La IA no respondió. Inténtalo de nuevo.')
  return result as T
}

const sameQuestion = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

// Crea la trivia completa. `onProgress` recibe el avance y las preguntas que ya están listas.
export const generateTrivia = async (
  source: AiSource,
  options: AiOptions,
  onProgress: (progress: AiProgress) => void,
  signal?: AbortSignal
): Promise<AiTrivia> => {
  let topic = ''
  let material = ''
  let focus = ''

  if (source.kind === 'tema') {
    topic = source.topic
  } else if (source.kind === 'pdf') {
    material = source.text
    focus = source.focus
  } else {
    // Un modelo que puede ver videos saca los apuntes; las preguntas salen de ahí
    onProgress({ stage: 'video', done: 0, total: options.count })
    const video = await callGenerator<{ notes: string; title: string }>({ action: 'video', url: source.url, focus: source.focus }, signal)
    material = video.notes
    topic = video.title
    focus = source.focus
  }

  const instructions = [focus ? `Céntrate en: ${focus}` : '', options.instructions].filter(Boolean).join('. ')
  const trivia: AiTrivia = { title: '', description: '', questions: [] }
  const seen = new Set<string>()
  const maxCalls = Math.ceil(options.count / BATCH_SIZE) + 2
  let emptyCalls = 0

  onProgress({ stage: 'questions', done: 0, total: options.count })

  for (let call = 0; call < maxCalls && trivia.questions.length < options.count && emptyCalls < 2; call++) {
    let batch: AiTrivia
    try {
      batch = await callGenerator<AiTrivia>({
        action: 'questions',
        count: Math.min(BATCH_SIZE, options.count - trivia.questions.length),
        topic,
        material,
        audience: options.audience,
        difficulty: options.difficulty,
        instructions,
        avoid: trivia.questions.map(question => question.text)
      }, signal)
    } catch (error) {
      // Si ya hay preguntas, se entregan las que hay en vez de perderlas
      if (signal?.aborted || !trivia.questions.length) throw error
      trivia.warning = `Solo salieron ${trivia.questions.length} de ${options.count} preguntas: ${error instanceof Error ? error.message : 'la IA dejó de responder'}`
      return trivia
    }

    trivia.title ||= batch.title
    trivia.description ||= batch.description

    const fresh = batch.questions.filter(question => {
      const key = sameQuestion(question.text)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    emptyCalls = fresh.length ? 0 : emptyCalls + 1
    trivia.questions.push(...fresh.slice(0, options.count - trivia.questions.length))
    onProgress({ stage: 'questions', done: trivia.questions.length, total: options.count })
  }

  if (!trivia.questions.length) throw new Error('La IA no devolvió preguntas. Prueba con otro tema o material.')
  if (trivia.questions.length < options.count) {
    trivia.warning = `Solo salieron ${trivia.questions.length} de ${options.count} preguntas. El material no daba para más sin repetirse.`
  }
  return trivia
}

// --- PDF ---

export interface PdfText {
  // Texto de cada página, en orden
  pages: string[]
}

// Lee el texto de un PDF sin subirlo a ningún lado. Un PDF escaneado (fotos de
// páginas) no tiene texto que leer y devuelve páginas vacías.
export const readPdfText = async (file: File, onProgress?: (page: number, total: number) => void): Promise<PdfText> => {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const loading = pdfjs.getDocument({ data: await file.arrayBuffer() })
  let document
  try {
    document = await loading.promise
  } catch {
    throw new Error('No se pudo abrir ese PDF. Puede estar dañado o protegido con contraseña.')
  }

  try {
    const pages: string[] = []
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number)
      const content = await page.getTextContent()
      let text = ''
      for (const item of content.items) {
        if (!('str' in item)) continue
        text += item.str + (item.hasEOL ? '\n' : ' ')
      }
      pages.push(text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim())
      onProgress?.(number, document.numPages)
    }
    return { pages }
  } finally {
    loading.destroy()
  }
}
