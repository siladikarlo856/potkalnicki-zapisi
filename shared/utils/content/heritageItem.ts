import type { ContentEntity, ContentStatus, ContentValidation } from './common'
import { contentStatus, isRecord, isUuid, issueCollector } from './common'
import { atlasSlug } from '../atlasSlug'
import { parseHeritageImages, type HeritageImageValue } from './heritageImage'

export const HERITAGE_ITEM_LIMITS = {
  name: 200,
  slug: 120,
  locality: 200,
  registryNumber: 40,
  period: 200,
  description: 20000,
  researchNotes: 5000
} as const

export const HERITAGE_VERIFICATIONS = ['unverified', 'in_review', 'verified', 'needs_update'] as const
export type HeritageVerification = typeof HERITAGE_VERIFICATIONS[number]

export const HERITAGE_VERIFICATION_LABELS: Record<HeritageVerification, string> = {
  unverified: 'Neprovjereno',
  in_review: 'U provjeri',
  verified: 'Provjereno',
  needs_update: 'Treba ažurirati'
}

export const HERITAGE_STATUSES = ['needs_verification', 'historical_site', 'protected'] as const
export type HeritageDatasetStatus = typeof HERITAGE_STATUSES[number]

export const HERITAGE_STATUS_LABELS: Record<HeritageDatasetStatus, string> = {
  needs_verification: 'Treba provjeru',
  historical_site: 'Povijesno mjesto',
  protected: 'Zaštićeno'
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export interface HeritageItemValue {
  name: string
  slug: string
  categoryId: string
  municipalityId: string
  settlementId: string | null
  locality: string | null
  verification: HeritageVerification
  heritageStatus: HeritageDatasetStatus | null | '__none__'
  registryNumber: string | null
  period: string | null
  description: string | null
  researchNotes: string
  latitude: number | null
  longitude: number | null
  noindex: boolean
  sourceIds: string[]
  /** Photos in display order; the first is the main one. */
  images: HeritageImageValue[]
  status: ContentStatus
}

export type HeritageItem = ContentEntity & HeritageItemValue & {
  /** Filled on list/detail for public links and display. */
  settlementSlug?: string | null
  categoryLabel?: string | null
}

function parseCoordinate(path: string, value: unknown, min: number, max: number, label: string, add: (path: string, message: string) => void) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'number' || Number.isNaN(value) || value < min || value > max) {
    add(path, `Polje „${label}“ mora biti broj između ${min} i ${max}.`)
    return null
  }
  return value
}

function parseSourceIds(value: unknown, add: (path: string, message: string) => void) {
  if (value === undefined || value === null) return [] as string[]
  if (!Array.isArray(value)) {
    add('sourceIds', 'Izvori moraju biti popis identifikatora.')
    return []
  }
  const ids: string[] = []
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string' || !isUuid(entry)) add(`sourceIds.${index}`, 'Izvor nije valjan UUID.')
    else ids.push(entry.toLowerCase())
  }
  return [...new Set(ids)]
}

/** Validates and projects a heritage item for the admin API. */
export function validateHeritageItem(input: unknown): ContentValidation<HeritageItemValue> {
  const check = issueCollector()
  const body = isRecord(input) ? input : {}
  if (!isRecord(input)) check.add('', 'Podaci zapisa baštine nedostaju.')
  const name = check.required('name', body.name, HERITAGE_ITEM_LIMITS.name, 'Naziv')
  let slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  if (!slug && name) slug = atlasSlug(name)
  if (!slug) check.add('slug', 'Polje „Adresa (slug)“ je obavezno.')
  else if (slug.length > HERITAGE_ITEM_LIMITS.slug) check.add('slug', `Polje „Adresa (slug)“ može imati najviše ${HERITAGE_ITEM_LIMITS.slug} znakova.`)
  else if (!SLUG_PATTERN.test(slug)) check.add('slug', 'Adresa smije sadržavati samo mala slova, brojeve i crtice.')
  const categoryId = typeof body.categoryId === 'string' ? body.categoryId.trim() : ''
  if (!isUuid(categoryId)) check.add('categoryId', 'Odaberi kategoriju.')
  const municipalityId = typeof body.municipalityId === 'string' ? body.municipalityId.trim() : ''
  if (!isUuid(municipalityId)) check.add('municipalityId', 'Odaberi grad ili općinu.')
  const settlementRaw = body.settlementId
  const settlementId = settlementRaw === undefined || settlementRaw === null || settlementRaw === ''
    ? null
    : (isUuid(settlementRaw) ? settlementRaw.toLowerCase() : (check.add('settlementId', 'Naselje nije valjano.'), null))
  const latitude = parseCoordinate('latitude', body.latitude, -90, 90, 'Geografska širina', check.add)
  const longitude = parseCoordinate('longitude', body.longitude, -180, 180, 'Geografska dužina', check.add)
  if ((latitude === null) !== (longitude === null)) check.add('latitude', 'Koordinate moraju biti unesene zajedno ili obe izostavljene.')
  const researchNotes = check.optional('researchNotes', body.researchNotes, HERITAGE_ITEM_LIMITS.researchNotes, 'Bilješke istraživanja') ?? ''
  const value: HeritageItemValue = {
    name,
    slug,
    categoryId: categoryId.toLowerCase(),
    municipalityId: municipalityId.toLowerCase(),
    settlementId,
    locality: check.optional('locality', body.locality, HERITAGE_ITEM_LIMITS.locality, 'Lokalitet'),
    verification: check.oneOf('verification', body.verification, HERITAGE_VERIFICATIONS, 'Status provjere') as HeritageVerification,
    heritageStatus: body.heritageStatus === undefined || body.heritageStatus === null || body.heritageStatus === '' || body.heritageStatus === '__none__'
      ? null
      : check.oneOf('heritageStatus', body.heritageStatus, HERITAGE_STATUSES, 'Status baštine') as HeritageDatasetStatus,
    registryNumber: check.optional('registryNumber', body.registryNumber, HERITAGE_ITEM_LIMITS.registryNumber, 'Registarski broj'),
    period: check.optional('period', body.period, HERITAGE_ITEM_LIMITS.period, 'Razdoblje'),
    description: check.optional('description', body.description, HERITAGE_ITEM_LIMITS.description, 'Opis'),
    researchNotes,
    latitude,
    longitude,
    noindex: body.noindex === true,
    sourceIds: parseSourceIds(body.sourceIds, check.add),
    images: parseHeritageImages(body.images, check),
    status: contentStatus(body.status, 'published', check.add)
  }
  return { value, issues: check.issues }
}
