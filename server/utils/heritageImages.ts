import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentIssue } from '../../shared/utils/content/common'
import { HERITAGE_IMAGE_BUCKET, HERITAGE_IMAGE_LIMITS } from '../../shared/utils/content/heritageImage'
import { fail } from './content/store'

// Uploading the photo files of heritage items. The admin screen (and the import script) resize a photo to a large
// copy and a thumbnail, then send both as base64 in one JSON body: every admin route accepts JSON only
// (server/middleware/admin-guard.ts), so a cross-site form can never post a file. The server trusts nothing it
// is told about the file: the type and the pixel size are read from the bytes.

export const IMAGE_FILE_MAX_BYTES = 1_500_000
/** Two files at the cap, base64-encoded, plus the JSON around them. */
export const IMAGE_UPLOAD_BODY_LIMIT = 4_200_000
const LARGE_MAX_SIDE = 2400
const THUMB_MAX_SIDE = 800

export interface ImageInfo {
  type: 'webp' | 'jpeg'
  width: number
  height: number
}

function u16be(bytes: Uint8Array, at: number) {
  return (bytes[at]! << 8) | bytes[at + 1]!
}

function u16le(bytes: Uint8Array, at: number) {
  return bytes[at]! | (bytes[at + 1]! << 8)
}

function u24le(bytes: Uint8Array, at: number) {
  return bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16)
}

function ascii(bytes: Uint8Array, at: number, length: number) {
  return String.fromCharCode(...bytes.subarray(at, at + length))
}

function webpInfo(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null
  const chunk = ascii(bytes, 12, 4)
  if (chunk === 'VP8 ') {
    // Lossy: a frame tag (3 bytes), the start code 9d 01 2a, then 14-bit width and height.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null
    return { type: 'webp', width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff }
  }
  if (chunk === 'VP8L') {
    // Lossless: signature 0x2f, then width - 1 and height - 1 in 14 bits each.
    if (bytes[20] !== 0x2f) return null
    const bits = bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24)
    return { type: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') {
    // Extended: canvas width - 1 and height - 1 in 24 bits each.
    return { type: 'webp', width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1 }
  }
  return null
}

// Start-of-frame markers carry the size; C4 (DHT), C8 (reserved) and CC (DAC) share the range but do not.
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

function jpegInfo(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let at = 2
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null
    const marker = bytes[at + 1]!
    if (marker === 0xff) {
      at += 1
      continue
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2
      continue
    }
    if (marker === 0xd9 || marker === 0xda) return null
    if (SOF.has(marker)) return { type: 'jpeg', height: u16be(bytes, at + 5), width: u16be(bytes, at + 7) }
    at += 2 + u16be(bytes, at + 2)
  }
  return null
}

/** The type and pixel size of a WebP or JPEG file, read from its bytes; null for anything else. */
export function imageInfo(bytes: Uint8Array): ImageInfo | null {
  const info = webpInfo(bytes) ?? jpegInfo(bytes)
  return info && info.width > 0 && info.height > 0 ? info : null
}

export interface ImageUploadFile {
  bytes: Buffer
  info: ImageInfo
}

/**
 * Checks one base64 file of an upload. Returns the decoded file, or a Croatian message for the admin screen.
 * `maxSide` bounds the longer side, so a full-size original is refused and the screen resizes first.
 */
export function checkImageFile(value: unknown, maxSide: number, label: string): ImageUploadFile | string {
  if (typeof value !== 'string' || !value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return `${label}: datoteka nedostaje.`
  const bytes = Buffer.from(value, 'base64')
  if (bytes.length > IMAGE_FILE_MAX_BYTES) return `${label}: datoteka je veća od ${Math.floor(IMAGE_FILE_MAX_BYTES / 1000)} kB.`
  const info = imageInfo(bytes)
  if (!info) return `${label}: samo WebP ili JPEG.`
  if (Math.max(info.width, info.height) > Math.min(maxSide, HERITAGE_IMAGE_LIMITS.side)) {
    return `${label}: najviše ${maxSide} piksela po duljoj stranici.`
  }
  return { bytes, info }
}

export interface StoredImage {
  path: string
  thumbPath: string
  width: number
  height: number
}

export type ImageUploadCheck
  = | { issues: ContentIssue[], large?: undefined, thumb?: undefined }
    | { issues: [], large: ImageUploadFile, thumb: ImageUploadFile }

/** Validates both files of an upload body (`image`, `thumb`); the issues carry Croatian messages for the admin screen. */
export function checkImageUpload(body: Record<string, unknown>): ImageUploadCheck {
  const large = checkImageFile(body.image, LARGE_MAX_SIDE, 'Fotografija')
  const thumb = checkImageFile(body.thumb, THUMB_MAX_SIDE, 'Umanjena fotografija')
  const issues: ContentIssue[] = []
  if (typeof large === 'string') issues.push({ path: 'image', message: large })
  if (typeof thumb === 'string') issues.push({ path: 'thumb', message: thumb })
  if (typeof large === 'string' || typeof thumb === 'string') return { issues }
  if (large.info.type !== thumb.info.type) {
    return { issues: [{ path: 'thumb', message: 'Fotografija i umanjena fotografija moraju biti iste vrste.' }] }
  }
  return { issues: [], large, thumb }
}

/** Stores both files under a fresh name; files are never overwritten, so a saved photo row keeps pointing at its file. */
export async function storeImageUpload(db: SupabaseClient, large: ImageUploadFile, thumb: ImageUploadFile): Promise<StoredImage> {
  const name = randomUUID()
  const extension = large.info.type === 'webp' ? 'webp' : 'jpg'
  const contentType = large.info.type === 'webp' ? 'image/webp' : 'image/jpeg'
  const path = `heritage/${name}.${extension}`
  const thumbPath = `heritage/${name}-thumb.${extension}`
  const bucket = db.storage.from(HERITAGE_IMAGE_BUCKET)
  for (const [target, file] of [[path, large], [thumbPath, thumb]] as const) {
    const { error } = await bucket.upload(target, file.bytes, { contentType, cacheControl: '31536000', upsert: false })
    if (error) {
      console.error('[images] Storage upload failed:', error.message)
      fail(502, 'Storage error', { message: 'Spremanje fotografije nije uspjelo. Provjeri da spremnik heritage-media postoji u Supabase Storageu.' })
    }
  }
  return { path, thumbPath, width: large.info.width, height: large.info.height }
}
