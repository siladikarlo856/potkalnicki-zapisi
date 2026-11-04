import type { ContentEntity, ContentStatus, ContentValidation } from './common'
import { contentFold, contentStatus, isRecord, isUuid, issueCollector } from './common'
import { atlasSlug } from '../atlasSlug'
import { HERITAGE_VERIFICATIONS, HERITAGE_VERIFICATION_LABELS, type HeritageVerification } from './heritageItem'

export const PERSON_LIMITS = {
  name: 200,
  slug: 120,
  role: 200,
  clue: 300,
  bio: 4000,
  born: 60,
  bornPlace: 200,
  died: 60,
  diedPlace: 200,
  openQuestions: 2000,
  researchNotes: 5000,
  relation: 200
} as const

export const PERSON_AREA_ROLES = ['rodjen', 'zivio', 'djelovao', 'umro', 'pokopan'] as const
export type PersonAreaRole = typeof PERSON_AREA_ROLES[number]

export const PERSON_AREA_ROLE_LABELS: Record<PersonAreaRole, string> = {
  rodjen: 'Rođen/a',
  zivio: 'Živio/la',
  djelovao: 'Djelovao/la',
  umro: 'Umro/la',
  pokopan: 'Pokopan/a'
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MAX_AREA_LINKS = 12
const MAX_ITEM_LINKS = 12
const MAX_SOURCES = 10

export interface PersonAreaLink {
  areaId: string
  role: PersonAreaRole
}

export interface PersonItemLink {
  itemId: string
  relation: string
}

export interface PersonValue {
  name: string
  slug: string
  role: string
  clue: string
  bio: string | null
  born: string | null
  bornYear: number | null
  bornPlace: string | null
  died: string
  diedYear: number
  diedPlace: string | null
  openQuestions: string | null
  researchNotes: string
  verification: HeritageVerification
  noindex: boolean
  areaLinks: PersonAreaLink[]
  itemLinks: PersonItemLink[]
  sourceIds: string[]
  status: ContentStatus
}

export type Person = ContentEntity & PersonValue & {
  yearsLabel?: string | null
  placesLabel?: string | null
}

function parseYear(path: string, value: unknown, required: boolean, add: (path: string, message: string) => void): number {
  if (value === undefined || value === null || value === '') {
    if (required) add(path, 'Godina smrti je obavezna.')
    return 0
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1000 || value > 2100) {
    add(path, 'Godina mora biti cijeli broj između 1000 i 2100.')
    return 0
  }
  return value
}

function parseOptionalYear(path: string, value: unknown, add: (path: string, message: string) => void): number | null {
  if (value === undefined || value === null || value === '') return null
  const year = parseYear(path, value, false, add)
  return year >= 1000 ? year : null
}

function parseLinks<T>(
  path: string,
  value: unknown,
  max: number,
  parseRow: (row: unknown, index: number) => T | null,
  add: (path: string, message: string) => void
) {
  if (value === undefined || value === null) return [] as T[]
  if (!Array.isArray(value)) {
    add(path, 'Popis mora biti niz.')
    return []
  }
  if (value.length > max) add(path, `Najviše ${max} stavki.`)
  const rows: T[] = []
  for (const [index, row] of value.entries()) {
    const parsed = parseRow(row, index)
    if (parsed) rows.push(parsed)
  }
  return rows
}

function dropEmptyAreaLinks(links: PersonAreaLink[]) {
  return links.filter(link => link.areaId)
}

function dropEmptyItemLinks(links: PersonItemLink[]) {
  return links.filter(link => link.itemId && link.relation.trim())
}

function clueContainsName(clue: string, name: string) {
  const foldedClue = contentFold(clue)
  const parts = contentFold(name).split(/\s+/).filter(part => part.length >= 3)
  return parts.some(part => foldedClue.includes(part))
}

/** Validates and projects a person for the admin API. */
export function validatePerson(input: unknown): ContentValidation<PersonValue> {
  const check = issueCollector()
  const body = isRecord(input) ? input : {}
  if (!isRecord(input)) check.add('', 'Podaci osobe nedostaju.')

  const name = check.required('name', body.name, PERSON_LIMITS.name, 'Ime')
  let slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  if (!slug && name) slug = atlasSlug(name)
  if (!slug) check.add('slug', 'Polje „Slug“ je obavezno.')
  else if (slug.length > PERSON_LIMITS.slug) check.add('slug', `Polje „Slug“ može imati najviše ${PERSON_LIMITS.slug} znakova.`)
  else if (!SLUG_PATTERN.test(slug)) check.add('slug', 'Slug smije sadržavati samo mala slova, brojeve i crtice.')

  const role = check.optional('role', body.role, PERSON_LIMITS.role, 'Uloga') ?? ''
  const clue = check.optional('clue', body.clue, PERSON_LIMITS.clue, 'Natuknica') ?? ''
  if (clue && name && clueContainsName(clue, name)) {
    check.add('clue', 'Natuknica ne bi smjela sadržavati ime ili prezime osobe.')
  }

  const died = check.required('died', body.died, PERSON_LIMITS.died, 'Smrt')
  let diedYear = 1900
  const parsedDiedYear = parseYear('diedYear', body.diedYear, true, check.add)
  if (parsedDiedYear >= 1000) diedYear = parsedDiedYear
  const bornYear = parseOptionalYear('bornYear', body.bornYear, check.add)
  if (bornYear && diedYear && bornYear > diedYear) check.add('bornYear', 'Godina rođenja ne može biti poslije godine smrti.')

  const areaLinks = parseLinks('areaLinks', body.areaLinks, MAX_AREA_LINKS, (row, index) => {
    if (!isRecord(row)) {
      check.add(`areaLinks.${index}`, 'Veza na mjesto nije valjana.')
      return null
    }
    const areaId = typeof row.areaId === 'string' && isUuid(row.areaId) ? row.areaId.toLowerCase() : (check.add(`areaLinks.${index}.areaId`, 'Mjesto nije valjano.'), null)
    const roleValue = check.oneOf(`areaLinks.${index}.role`, row.role, PERSON_AREA_ROLES, 'Uloga mjesta') as PersonAreaRole | null
    if (!areaId || !roleValue) return null
    return { areaId, role: roleValue }
  }, check.add)

  const itemLinks = parseLinks('itemLinks', body.itemLinks, MAX_ITEM_LINKS, (row, index) => {
    if (!isRecord(row)) {
      check.add(`itemLinks.${index}`, 'Veza na baštinu nije valjana.')
      return null
    }
    const itemId = typeof row.itemId === 'string' && isUuid(row.itemId) ? row.itemId.toLowerCase() : (check.add(`itemLinks.${index}.itemId`, 'Zapis baštine nije valjan.'), null)
    const relation = check.required(`itemLinks.${index}.relation`, row.relation, PERSON_LIMITS.relation, 'Odnos')
    if (!itemId || !relation) return null
    return { itemId, relation }
  }, check.add)

  const sourceIds: string[] = []
  if (body.sourceIds === undefined || body.sourceIds === null) {
    // ok
  } else if (!Array.isArray(body.sourceIds)) {
    check.add('sourceIds', 'Izvori moraju biti popis identifikatora.')
  } else {
    if (body.sourceIds.length > MAX_SOURCES) check.add('sourceIds', `Najviše ${MAX_SOURCES} izvora.`)
    for (const [index, entry] of body.sourceIds.entries()) {
      if (typeof entry !== 'string' || !isUuid(entry)) check.add(`sourceIds.${index}`, 'Izvor nije valjan UUID.')
      else sourceIds.push(entry.toLowerCase())
    }
  }
  const uniqueSources = [...new Set(sourceIds)]

  const status = contentStatus(body.status, 'draft', check.add)
  if (status === 'published') {
    if (!uniqueSources.length) check.add('sourceIds', 'Osoba treba barem jedan izvor.')
  }

  const value: PersonValue = {
    name,
    slug,
    role,
    clue,
    bio: check.optional('bio', body.bio, PERSON_LIMITS.bio, 'Biografija'),
    born: check.optional('born', body.born, PERSON_LIMITS.born, 'Rođen/a'),
    bornYear,
    bornPlace: check.optional('bornPlace', body.bornPlace, PERSON_LIMITS.bornPlace, 'Mjesto rođenja'),
    died,
    diedYear,
    diedPlace: check.optional('diedPlace', body.diedPlace, PERSON_LIMITS.diedPlace, 'Mjesto smrti'),
    openQuestions: check.optional('openQuestions', body.openQuestions, PERSON_LIMITS.openQuestions, 'Što još provjeravamo'),
    researchNotes: check.optional('researchNotes', body.researchNotes, PERSON_LIMITS.researchNotes, 'Bilješke istraživanja') ?? '',
    verification: check.oneOf('verification', body.verification, HERITAGE_VERIFICATIONS, 'Status provjere') as HeritageVerification,
    noindex: body.noindex === true,
    areaLinks: dropEmptyAreaLinks(areaLinks),
    itemLinks: dropEmptyItemLinks(itemLinks),
    sourceIds: uniqueSources,
    status
  }
  return { value, issues: check.issues }
}

export { HERITAGE_VERIFICATION_LABELS as PERSON_VERIFICATION_LABELS, HERITAGE_VERIFICATIONS as PERSON_VERIFICATIONS }
