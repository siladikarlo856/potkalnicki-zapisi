import type { ContentEntity, ContentStatus, ContentValidation } from './common'
import { contentStatus, isRecord, isUuid, issueCollector } from './common'

// Places (Mjesta): the `areas` table and `area_regions` membership. Limits and rules mirror the
// database checks in `20261103010000_content_tables.sql`.

export const AREA_KINDS = ['country', 'county', 'region', 'town', 'municipality', 'settlement'] as const
export type AreaKind = typeof AREA_KINDS[number]

/** Filter value for towns and municipalities sharing one public slug namespace. */
export const AREA_KIND_LAU = 'lau' as const

export const AREA_KIND_LABELS: Record<AreaKind, string> = {
  country: 'Država',
  county: 'Županija',
  region: 'Regija',
  town: 'Grad',
  municipality: 'Općina',
  settlement: 'Naselje'
}

export const AREA_LIMITS = {
  name: 200,
  slug: 120,
  officialCode: 40,
  geonamesId: 10,
  description: 10_000,
  regionIds: 20
} as const

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const GEONAMES = /^[0-9]{1,10}$/

const PARENT_KINDS: Record<AreaKind, readonly AreaKind[]> = {
  country: [],
  county: ['country'],
  region: ['country', 'county'],
  town: ['county'],
  municipality: ['county'],
  settlement: ['town', 'municipality']
}

/** Kinds that may belong to a region through `area_regions`. */
export function areaKindMayJoinRegion(kind: AreaKind) {
  return kind !== 'country' && kind !== 'region'
}

/** Published rows that need a public slug (same rule as `areas_routable_slug`). */
export function areaKindNeedsSlug(kind: AreaKind, status: ContentStatus) {
  return status === 'published' && (kind === 'town' || kind === 'municipality' || kind === 'settlement')
}

export interface AreaFields {
  kind: AreaKind
  parentId: string | null
  name: string
  slug: string | null
  officialCode: string | null
  geonamesId: string | null
  latitude: number | null
  longitude: number | null
  description: string | null
}

export interface AreaValue extends AreaFields {
  regionIds: string[]
  status: ContentStatus
}

export type Area = ContentEntity & Omit<AreaValue, 'status' | 'regionIds'> & { regionIds?: string[] }

function parseCoordinate(path: string, value: unknown, min: number, max: number, label: string, add: (p: string, m: string) => void): number | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    add(path, `Polje „${label}“ mora biti broj između ${min} i ${max}.`)
    return null
  }
  return value
}

function parseRegionIds(value: unknown, add: (path: string, message: string) => void): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    add('regionIds', 'Popis regija mora biti niz identifikatora.')
    return []
  }
  if (value.length > AREA_LIMITS.regionIds) add('regionIds', `Najviše ${AREA_LIMITS.regionIds} regija.`)
  const ids: string[] = []
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string' || !isUuid(entry)) add(`regionIds.${index}`, 'Neispravan identifikator regije.')
    else ids.push(entry.toLowerCase())
  }
  return [...new Set(ids)]
}

/** Validates and projects an area; unknown keys are dropped. */
export function validateArea(input: unknown, id?: string): ContentValidation<AreaValue> {
  const check = issueCollector()
  const body = isRecord(input) ? input : {}
  if (!isRecord(input)) check.add('', 'Podaci mjesta nedostaju.')

  const kind = check.oneOf('kind', body.kind, AREA_KINDS, 'Vrsta')
  const name = check.required('name', body.name, AREA_LIMITS.name, 'Naziv')
  const status = contentStatus(body.status, 'published', check.add)

  let parentId = check.optional('parentId', body.parentId, 36, 'Nadređeno mjesto')
  if (typeof body.parentId === 'string' && body.parentId.trim() && !isUuid(body.parentId)) {
    check.add('parentId', 'Neispravan identifikator nadređenog mjesta.')
    parentId = null
  }
  if (parentId && !isUuid(parentId)) parentId = null
  if (parentId) parentId = parentId.toLowerCase()
  if (id && parentId === id.toLowerCase()) check.add('parentId', 'Mjesto ne može biti vlastito nadređeno mjesto.')

  if (kind === 'country') {
    if (parentId) check.add('parentId', 'Država ne smije imati nadređeno mjesto.')
    parentId = null
  } else if (!parentId) {
    check.add('parentId', 'Polje „Nadređeno mjesto“ je obavezno.')
  }

  const slug = check.optional('slug', body.slug, AREA_LIMITS.slug, 'Slug')
  if (slug && !SLUG.test(slug)) check.add('slug', 'Slug smije sadržavati samo mala slova, brojeve i crtice.')
  if (areaKindNeedsSlug(kind, status) && !slug) check.add('slug', 'Objavljeno mjesto ove vrste mora imati slug.')

  const officialCode = check.optional('officialCode', body.officialCode, AREA_LIMITS.officialCode, 'Službeni kod')
  const geonamesId = check.optional('geonamesId', body.geonamesId, AREA_LIMITS.geonamesId, 'GeoNames ID')
  if (geonamesId && !GEONAMES.test(geonamesId)) check.add('geonamesId', 'GeoNames ID mora imati do deset znamenki.')
  const description = check.optional('description', body.description, AREA_LIMITS.description, 'Opis')

  const latitude = parseCoordinate('latitude', body.latitude, -90, 90, 'Geografska širina', check.add)
  const longitude = parseCoordinate('longitude', body.longitude, -180, 180, 'Geografska dužina', check.add)
  if ((latitude === null) !== (longitude === null)) {
    check.add('latitude', 'Koordinate moraju biti unesene zajedno ili obe izostavljene.')
    check.add('longitude', 'Koordinate moraju biti unesene zajedno ili obe izostavljene.')
  }

  let regionIds = parseRegionIds(body.regionIds, check.add)
  if (!areaKindMayJoinRegion(kind)) {
    if (regionIds.length) check.add('regionIds', 'Ova vrsta mjesta ne može pripadati regiji.')
    regionIds = []
  }

  if (kind && parentId && PARENT_KINDS[kind].length) {
    // Parent kind is verified in the database; here we only require a parent id when needed.
    void PARENT_KINDS[kind]
  }

  const value: AreaValue = {
    kind,
    parentId,
    name,
    slug,
    officialCode,
    geonamesId,
    latitude,
    longitude,
    description,
    regionIds,
    status
  }
  return { value, issues: check.issues }
}

/** Admin list label: kind plus bare name (Grad/Općina is derived on public pages). */
export function areaAdminLabel(kind: AreaKind, name: string) {
  return `${AREA_KIND_LABELS[kind]}: ${name}`
}
