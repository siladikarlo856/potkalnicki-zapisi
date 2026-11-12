// Shrinks a photo in the browser before upload: the large copy for the item page and a thumbnail for cards, both
// WebP where the browser can encode it (JPEG otherwise, e.g. older Safari). The server checks the result again.

export const IMAGE_LARGE_SIDE = 1600
export const IMAGE_THUMB_SIDE = 480
// Byte budgets well under the server's 1.5 MB cap, so both files as base64 stay under 1 MB of JSON (a proxy in
// front of the app may refuse larger bodies). Quality steps down until a file fits.
const LARGE_BUDGET = 600_000
const THUMB_BUDGET = 120_000

export interface ResizedImage {
  /** Base64 without the data: prefix, as the upload endpoint takes it. */
  base64: string
  type: 'image/webp' | 'image/jpeg'
  width: number
  height: number
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality))
}

function toBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function encode(source: ImageBitmap, maxSide: number, budget: number, type: 'image/webp' | 'image/jpeg'): Promise<ResizedImage> {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Preglednik ne može obraditi fotografiju.')
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, width, height)
  for (const quality of [0.82, 0.7, 0.55, 0.4]) {
    const blob = await toBlob(canvas, type, quality)
    if (!blob || blob.type !== type) throw new Error('unsupported')
    if (blob.size <= budget) return { base64: await toBase64(blob), type, width, height }
  }
  throw new Error('Fotografija je i nakon smanjivanja prevelika.')
}

/** The large copy and the thumbnail of a photo file, both of the same type. */
export async function resizeImage(file: File) {
  let source: ImageBitmap
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('Datoteka nije fotografija koju preglednik može otvoriti.')
  }
  try {
    for (const type of ['image/webp', 'image/jpeg'] as const) {
      try {
        const large = await encode(source, IMAGE_LARGE_SIDE, LARGE_BUDGET, type)
        const thumb = await encode(source, IMAGE_THUMB_SIDE, THUMB_BUDGET, type)
        return { large, thumb }
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'unsupported') throw error
      }
    }
    throw new Error('Preglednik ne može spremiti fotografiju kao WebP ni JPEG.')
  } finally {
    source.close()
  }
}
