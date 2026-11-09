import type { issueCollector } from './common'
import { isRecord } from './common'

// Photos of heritage items: the licences the site accepts, how a photo is credited, and the checks the admin
// form and the API share. Files live in the public Storage bucket `heritage-media`
// (supabase/migrations/20261109000000_heritage_item_images.sql); a photo row names the large copy and the
// thumbnail, its size, alt text and the credit every reuse needs (author, licence, source).

export const HERITAGE_IMAGE_BUCKET = 'heritage-media'

/** Free licences, plus `permission`: used with the rights holder's written permission. */
export const IMAGE_LICENSES = [
  'pd', 'cc0-1.0', 'cc-by-2.0', 'cc-by-2.5', 'cc-by-3.0', 'cc-by-4.0',
  'cc-by-sa-2.0', 'cc-by-sa-2.5', 'cc-by-sa-3.0', 'cc-by-sa-4.0', 'permission'
] as const
export type ImageLicense = typeof IMAGE_LICENSES[number]

export const IMAGE_LICENSE_LABELS: Record<ImageLicense, string> = {
  'pd': 'Javno dobro',
  'cc0-1.0': 'CC0 1.0',
  'cc-by-2.0': 'CC BY 2.0',
  'cc-by-2.5': 'CC BY 2.5',
  'cc-by-3.0': 'CC BY 3.0',
  'cc-by-4.0': 'CC BY 4.0',
  'cc-by-sa-2.0': 'CC BY-SA 2.0',
  'cc-by-sa-2.5': 'CC BY-SA 2.5',
  'cc-by-sa-3.0': 'CC BY-SA 3.0',
  'cc-by-sa-4.0': 'CC BY-SA 4.0',
  'permission': 'Uz dopuštenje autora'
}

/** The licence's deed, linked from every credit; null for `permission`. */
export function imageLicenseUrl(license: ImageLicense): string | null {
  if (license === 'pd') return 'https://creativecommons.org/publicdomain/mark/1.0/'
  if (license === 'cc0-1.0') return 'https://creativecommons.org/publicdomain/zero/1.0/'
  const match = /^cc-(by|by-sa)-(\d\.\d)$/.exec(license)
  return match ? `https://creativecommons.org/licenses/${match[1]}/${match[2]}/` : null
}

export const HERITAGE_IMAGE_LIMITS = {
  perItem: 6,
  alt: 300,
  caption: 500,
  author: 200,
  url: 1000,
  side: 4000
} as const

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
export const HERITAGE_IMAGE_PATH = new RegExp(`^heritage/${UUID}\\.(webp|jpg)$`)
export const HERITAGE_THUMB_PATH = new RegExp(`^heritage/${UUID}-thumb\\.(webp|jpg)$`)

/** One photo as the admin API reads and writes it (the `images` sidecar of a heritage item). */
export interface HeritageImageValue {
  path: string
  thumbPath: string
  width: number
  height: number
  alt: string
  caption: string | null
  author: string
  authorUrl: string | null
  sourceUrl: string | null
  license: ImageLicense
}

type Check = ReturnType<typeof issueCollector>

function dimension(check: Check, path: string, value: unknown, label: string) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= HERITAGE_IMAGE_LIMITS.side) return value
  check.add(path, `${label} mora biti cijeli broj između 1 i ${HERITAGE_IMAGE_LIMITS.side}.`)
  return 0
}

function parseImage(check: Check, entry: unknown, index: number): HeritageImageValue {
  const at = (field: string) => `images.${index}.${field}`
  const body = isRecord(entry) ? entry : {}
  if (!isRecord(entry)) check.add(`images.${index}`, 'Podaci fotografije nedostaju.')
  const path = typeof body.path === 'string' ? body.path : ''
  if (!HERITAGE_IMAGE_PATH.test(path)) check.add(at('path'), 'Datoteka fotografije nije valjana; učitaj je ponovno.')
  const thumbPath = typeof body.thumbPath === 'string' ? body.thumbPath : ''
  if (!HERITAGE_THUMB_PATH.test(thumbPath)) check.add(at('thumbPath'), 'Umanjena fotografija nije valjana; učitaj je ponovno.')
  const license = check.oneOf(at('license'), body.license, IMAGE_LICENSES, 'Licencija')
  const sourceUrl = check.url(at('sourceUrl'), body.sourceUrl, HERITAGE_IMAGE_LIMITS.url, 'Izvor fotografije')
  if (!sourceUrl && license && license !== 'permission') {
    check.add(at('sourceUrl'), 'Za fotografiju pod slobodnom licencijom upiši poveznicu na izvor.')
  }
  return {
    path,
    thumbPath,
    width: dimension(check, at('width'), body.width, 'Širina'),
    height: dimension(check, at('height'), body.height, 'Visina'),
    alt: check.required(at('alt'), body.alt, HERITAGE_IMAGE_LIMITS.alt, 'Opis za čitače zaslona'),
    caption: check.optional(at('caption'), body.caption, HERITAGE_IMAGE_LIMITS.caption, 'Potpis'),
    author: check.required(at('author'), body.author, HERITAGE_IMAGE_LIMITS.author, 'Autor'),
    authorUrl: check.url(at('authorUrl'), body.authorUrl, HERITAGE_IMAGE_LIMITS.url, 'Poveznica na autora'),
    sourceUrl,
    license
  }
}

/** Validates an item's photos, in order; the first is the main photo. */
export function parseHeritageImages(value: unknown, check: Check): HeritageImageValue[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    check.add('images', 'Fotografije moraju biti popis.')
    return []
  }
  if (value.length > HERITAGE_IMAGE_LIMITS.perItem) {
    check.add('images', `Zapis može imati najviše ${HERITAGE_IMAGE_LIMITS.perItem} fotografija.`)
  }
  const images = value.slice(0, HERITAGE_IMAGE_LIMITS.perItem).map((entry, index) => parseImage(check, entry, index))
  const seen = new Set<string>()
  for (const [index, image] of images.entries()) {
    if (image.path && seen.has(image.path)) check.add(`images.${index}.path`, 'Ista fotografija je dodana dvaput.')
    seen.add(image.path)
  }
  return images
}

/** The public URL of a file in the bucket, from the Supabase project URL. */
export function heritageImageUrl(storageBase: string, path: string) {
  return `${storageBase.replace(/\/+$/, '')}/storage/v1/object/public/${HERITAGE_IMAGE_BUCKET}/${path}`
}
