// Optimización de las imágenes y los sonidos de las preguntas antes de subirlos.
// Todo ocurre en el dispositivo de quien crea la trivia: al almacenamiento solo
// llega el archivo ya reducido.

export interface OptimizedMedia {
  blob: Blob
  extension: string
  originalBytes: number
  bytes: number
}

export interface OptimizedImage extends OptimizedMedia {
  width: number
  height: number
}

export interface OptimizedAudio extends OptimizedMedia {
  duration: number // segundos
}

// --- Imágenes ---

// 1280 px en el lado largo se ve nítido en un proyector y en pantallas retina
const IMAGE_MAX_SIDE = 1280
// Solo se baja la calidad si la imagen pasa de este peso
const IMAGE_TARGET_BYTES = 350 * 1024
const IMAGE_QUALITIES = [0.82, 0.76, 0.7]
const IMAGE_MAX_INPUT_BYTES = 40 * 1024 * 1024
// Formatos que se pueden subir tal cual cuando la original ya es ligera
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png'
}

interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}

const decodeImage = async (file: Blob): Promise<DecodedImage> => {
  try {
    // respeta la orientación con la que el teléfono guardó la foto
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
  } catch {
    // SVG y navegadores sin createImageBitmap
    const url = URL.createObjectURL(file)
    try {
      const image = new Image()
      image.decoding = 'async'
      image.src = url
      await image.decode()
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('sin tamaño')
      return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) }
    } catch {
      URL.revokeObjectURL(url)
      throw new Error('No se pudo leer esa imagen. Prueba con JPG, PNG o WebP.')
    }
  }
}

const newCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Este navegador no puede procesar imágenes')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  return { canvas, context }
}

// Reduce por mitades hasta acercarse al tamaño final: de un solo salto las
// fotos grandes quedan con dientes de sierra en varios navegadores
const drawScaled = (image: DecodedImage, width: number, height: number, background?: string) => {
  let source = image.source
  let sourceWidth = image.width
  let sourceHeight = image.height

  while (sourceWidth > width * 2) {
    const halfWidth = Math.ceil(sourceWidth / 2)
    const halfHeight = Math.ceil(sourceHeight / 2)
    const step = newCanvas(halfWidth, halfHeight)
    step.context.drawImage(source, 0, 0, halfWidth, halfHeight)
    source = step.canvas
    sourceWidth = halfWidth
    sourceHeight = halfHeight
  }

  const { canvas, context } = newCanvas(width, height)
  if (background) {
    context.fillStyle = background
    context.fillRect(0, 0, width, height)
  }
  context.drawImage(source, 0, 0, width, height)
  return canvas
}

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality))

// Codifica bajando la calidad solo lo necesario para acercarse al peso deseado
const encodeImage = async (canvas: HTMLCanvasElement, type: string) => {
  let lightest: Blob | null = null
  for (const quality of IMAGE_QUALITIES) {
    const blob = await canvasToBlob(canvas, type, quality)
    // un navegador que no sabe codificar el formato devuelve PNG
    if (!blob || blob.type !== type) return null
    lightest = blob
    if (blob.size <= IMAGE_TARGET_BYTES) break
  }
  return lightest
}

export const optimizeImage = async (file: File): Promise<OptimizedImage> => {
  if (!file.type.startsWith('image/')) throw new Error('Ese archivo no es una imagen')
  if (file.size > IMAGE_MAX_INPUT_BYTES) throw new Error('La imagen es demasiado pesada (máximo 40 MB)')

  const image = await decodeImage(file)
  try {
    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))

    let extension = 'webp'
    let blob = await encodeImage(drawScaled(image, width, height), 'image/webp')
    if (!blob) {
      // Safari no codifica WebP: JPEG, que no tiene transparencia, sobre blanco
      extension = 'jpg'
      blob = await encodeImage(drawScaled(image, width, height, '#ffffff'), 'image/jpeg')
    }
    if (!blob) throw new Error('No se pudo procesar la imagen')

    // Una imagen que ya era pequeña y ligera se sube tal cual, sin recomprimir
    const originalExtension = IMAGE_EXTENSIONS[file.type]
    if (scale === 1 && originalExtension && file.size <= blob.size) {
      return { blob: file, extension: originalExtension, originalBytes: file.size, bytes: file.size, width, height }
    }

    return { blob, extension, originalBytes: file.size, bytes: blob.size, width, height }
  } finally {
    image.release()
  }
}

// --- Sonido ---

// De un audio largo se usa un fragmento: las preguntas duran segundos
export const AUDIO_MAX_SECONDS = 30
// MP3 mono a 96 kbps: la música se oye limpia y medio minuto pesa unos 360 KB.
// Se usa MP3 porque suena en todos los navegadores y teléfonos.
const AUDIO_SAMPLE_RATE = 44100
const AUDIO_KBPS = 96
const AUDIO_MAX_INPUT_BYTES = 40 * 1024 * 1024
const AUDIO_MAX_INPUT_SECONDS = 10 * 60
// Volumen: el pico queda a -1 dB; un audio muy bajito sube como mucho 18 dB
const AUDIO_PEAK = 0.89
const AUDIO_MAX_GAIN = 8
const FADE_IN_SECONDS = 0.02
const FADE_OUT_SECONDS = 0.4

// Audio ya leído, en mono y a 16 bits, del que se recorta el fragmento
export interface DecodedAudio {
  samples: Int16Array
  sampleRate: number
  duration: number // segundos
  file: File
}

// Duración según el propio navegador, sin decodificar el archivo entero
const probeDuration = (file: Blob) =>
  new Promise<number | null>(resolve => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    const done = (duration: number | null) => {
      URL.revokeObjectURL(url)
      resolve(duration)
    }
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? audio.duration : null)
    audio.onerror = () => done(null)
    audio.src = url
  })

export const decodeAudio = async (file: File): Promise<DecodedAudio> => {
  if (file.size > AUDIO_MAX_INPUT_BYTES) throw new Error('El audio es demasiado pesado (máximo 40 MB)')

  const probedDuration = await probeDuration(file)
  if (probedDuration !== null && probedDuration > AUDIO_MAX_INPUT_SECONDS) {
    throw new Error('El audio es demasiado largo (máximo 10 minutos)')
  }

  const OfflineContext: typeof OfflineAudioContext | undefined =
    window.OfflineAudioContext || (window as any).webkitOfflineAudioContext
  if (!OfflineContext) throw new Error('Este navegador no puede procesar audio')

  let buffer: AudioBuffer
  try {
    // decodificar en un contexto a 44,1 kHz deja el audio ya a esa frecuencia
    const context = new OfflineContext(1, 1, AUDIO_SAMPLE_RATE)
    const data = await file.arrayBuffer()
    buffer = await new Promise<AudioBuffer>((resolve, reject) => {
      // Safari antiguo solo acepta la forma con callbacks
      const pending = context.decodeAudioData(data, resolve, reject)
      if (pending) pending.then(resolve, reject)
    })
  } catch {
    throw new Error('No se pudo leer ese audio. Prueba con MP3, M4A o WAV.')
  }

  if (buffer.duration > AUDIO_MAX_INPUT_SECONDS) throw new Error('El audio es demasiado largo (máximo 10 minutos)')
  if (!buffer.length) throw new Error('Ese audio está vacío')

  // mezcla a mono
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index))
  const samples = new Int16Array(buffer.length)
  for (let i = 0; i < samples.length; i++) {
    let sum = 0
    for (const channel of channels) sum += channel[i]
    const value = sum / channels.length
    samples[i] = Math.max(-32768, Math.min(32767, Math.round(value * 32767)))
  }

  return { samples, sampleRate: buffer.sampleRate, duration: buffer.duration, file }
}

// Cede el turno al navegador para que la pantalla no se congele. No usa
// setTimeout porque en pestañas en segundo plano tarda un segundo por vuelta.
const yieldToBrowser = () =>
  new Promise<void>(resolve => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => resolve()
    channel.port2.postMessage(null)
  })

interface EncodeAudioOptions {
  onProgress?: (fraction: number) => void
  // para abandonar la compresión si se elige otro fragmento a mitad
  signal?: AbortSignal
}

// Recorta el fragmento que empieza en `startSeconds` y lo codifica en MP3
export const encodeAudioClip = async (
  audio: DecodedAudio,
  startSeconds = 0,
  { onProgress, signal }: EncodeAudioOptions = {}
): Promise<OptimizedAudio> => {
  const { Mp3Encoder } = await import('@breezystack/lamejs')

  const { samples, sampleRate, file } = audio
  const maxLength = Math.round(AUDIO_MAX_SECONDS * sampleRate)
  const first = Math.max(0, Math.min(Math.round(startSeconds * sampleRate), samples.length - 1))
  const length = Math.min(samples.length - first, maxLength)
  const clip = samples.subarray(first, first + length)

  let peak = 0
  for (let i = 0; i < length; i++) {
    const value = Math.abs(clip[i])
    if (value > peak) peak = value
  }
  const gain = peak > 0 ? Math.min(AUDIO_MAX_GAIN, (AUDIO_PEAK * 32767) / peak) : 1

  // Un corte en seco suena a chasquido: entrada y salida suaves donde se recortó
  const fadeIn = first > 0 ? Math.round(FADE_IN_SECONDS * sampleRate) : 0
  const fadeOut = first + length < samples.length ? Math.round(FADE_OUT_SECONDS * sampleRate) : 0

  const encoder = new Mp3Encoder(1, sampleRate, AUDIO_KBPS)
  const parts: BlobPart[] = []
  const blockSize = 1152 * 16
  let lastPause = performance.now()

  for (let offset = 0; offset < length; offset += blockSize) {
    const block = new Int16Array(Math.min(blockSize, length - offset))
    for (let i = 0; i < block.length; i++) {
      const position = offset + i
      let value = clip[position] * gain
      if (position < fadeIn) value *= position / fadeIn
      if (position >= length - fadeOut) value *= (length - position) / fadeOut
      block[i] = Math.max(-32768, Math.min(32767, Math.round(value)))
    }
    const encoded = encoder.encodeBuffer(block)
    if (encoded.length) parts.push(new Uint8Array(encoded))

    if (performance.now() - lastPause > 30) {
      onProgress?.(offset / length)
      await yieldToBrowser()
      if (signal?.aborted) throw new DOMException('Compresión cancelada', 'AbortError')
      lastPause = performance.now()
    }
  }
  const tail = encoder.flush()
  if (tail.length) parts.push(new Uint8Array(tail))
  onProgress?.(1)

  const blob = new Blob(parts, { type: 'audio/mpeg' })
  const duration = length / sampleRate

  // Un MP3 corto que ya pesaba menos se sube tal cual, sin recomprimir
  if (file.type === 'audio/mpeg' && length === samples.length && file.size <= blob.size) {
    return { blob: file, extension: 'mp3', originalBytes: file.size, bytes: file.size, duration }
  }

  return { blob, extension: 'mp3', originalBytes: file.size, bytes: blob.size, duration }
}

// --- Texto para la interfaz ---

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const formatSeconds = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
