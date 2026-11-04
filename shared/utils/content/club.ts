import type { ContentEntity, ContentStatus, ContentValidation } from './common'
import { contentFold, contentStatus, isRecord, isUuid, issueCollector } from './common'
import { atlasSlug } from '../atlasSlug'
import { HERITAGE_VERIFICATIONS, HERITAGE_VERIFICATION_LABELS, type HeritageVerification } from './heritageItem'

export const CLUB_LIMITS = {
  name: 200,
  slug: 120,
  fullName: 300,
  sport: 80,
  homeGround: 300,
  researchNotes: 5000,
  competition: 200,
  team: 40,
  sourceUrl: 500,
  season: 7
} as const

export const CLUB_SPORTS = ['nogomet', 'nogomet na mali gol', 'šah', 'boks', 'konjički'] as const

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const SEASON_PATTERN = /^\d{4}\/\d{2}$/
const MAX_SEASONS = 8
const MAX_SOURCES = 10

export interface ClubSeasonValue {
  season: string
  competition: string
  team: string
  sourceUrl: string | null
  checkedAt: string
}

export interface ClubValue {
  name: string
  slug: string
  fullName: string | null
  sport: string
  settlementId: string
  foundedYear: number | null
  homeGround: string | null
  researchNotes: string
  verification: HeritageVerification
  noindex: boolean
  seasons: ClubSeasonValue[]
  sourceIds: string[]
  status: ContentStatus
}

export type Club = ContentEntity & ClubValue & {
  settlementLabel?: string | null
  seasonSummary?: string | null
}

function parseSeasonRow(row: unknown, index: number, add: (path: string, message: string) => void): ClubSeasonValue | null {
  if (!isRecord(row)) {
    add(`seasons.${index}`, 'Red nije valjan.')
    return null
  }
  const season = typeof row.season === 'string' ? row.season.trim() : ''
  if (!SEASON_PATTERN.test(season)) add(`seasons.${index}.season`, 'Sezona mora biti oblika 2026/27.')
  const competition = typeof row.competition === 'string' ? row.competition.trim() : ''
  if (!competition || competition.length > CLUB_LIMITS.competition) add(`seasons.${index}.competition`, 'Natjecanje je obavezno.')
  const team = typeof row.team === 'string' && row.team.trim() ? row.team.trim() : 'seniori'
  if (team.length > CLUB_LIMITS.team) add(`seasons.${index}.team`, 'Previše duga oznaka ekipe.')
  const sourceUrl = typeof row.sourceUrl === 'string' && row.sourceUrl.trim() ? row.sourceUrl.trim() : null
  if (sourceUrl && sourceUrl.length > CLUB_LIMITS.sourceUrl) add(`seasons.${index}.sourceUrl`, 'URL izvora je predugačak.')
  const checkedAt = typeof row.checkedAt === 'string' ? row.checkedAt.trim() : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedAt)) add(`seasons.${index}.checkedAt`, 'Datum provjere mora biti YYYY-MM-DD.')
  if (!season || !competition || !checkedAt) return null
  return { season, competition, team, sourceUrl, checkedAt }
}

function parseYear(path: string, value: unknown, required: boolean, add: (path: string, message: string) => void): number | null {
  if (value === undefined || value === null || value === '') {
    if (required) add(path, 'Godina je obavezna.')
    return null
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1800 || value > 2100) {
    add(path, 'Godina osnivanja mora biti cijeli broj između 1800 i 2100.')
    return null
  }
  return value
}

/** Validates and projects a club for the admin API. */
export function validateClub(input: unknown): ContentValidation<ClubValue> {
  const check = issueCollector()
  const body = isRecord(input) ? input : {}
  if (!isRecord(input)) check.add('', 'Podaci kluba nedostaju.')

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > CLUB_LIMITS.name) check.add('name', 'Ime kluba je obavezno (najviše 200 znakova).')

  let slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  if (!slug) slug = atlasSlug(name)
  if (!slug || slug.length > CLUB_LIMITS.slug || !SLUG_PATTERN.test(slug)) check.add('slug', 'Slug nije valjan.')

  const fullName = typeof body.fullName === 'string' && body.fullName.trim() ? body.fullName.trim() : null
  if (fullName && fullName.length > CLUB_LIMITS.fullName) check.add('fullName', 'Puni naziv je predugačak.')

  const sport = typeof body.sport === 'string' ? body.sport.trim() : ''
  if (!sport || sport.length > CLUB_LIMITS.sport) check.add('sport', 'Sport je obavezan.')

  const settlementId = typeof body.settlementId === 'string' ? body.settlementId.trim() : ''
  if (!isUuid(settlementId)) check.add('settlementId', 'Odaberite naselje.')

  const foundedYear = parseYear('foundedYear', body.foundedYear, false, check.add)
  const homeGround = typeof body.homeGround === 'string' && body.homeGround.trim() ? body.homeGround.trim() : null
  if (homeGround && homeGround.length > CLUB_LIMITS.homeGround) check.add('homeGround', 'Domaći teren je predugačak.')

  const researchNotes = typeof body.researchNotes === 'string' ? body.researchNotes : ''
  if (researchNotes.length > CLUB_LIMITS.researchNotes) check.add('researchNotes', 'Bilješke su predugačke.')

  const verification = HERITAGE_VERIFICATIONS.includes(body.verification as HeritageVerification)
    ? body.verification as HeritageVerification
    : 'unverified'

  const noindex = body.noindex === true
  const status = contentStatus(body.status, 'draft', check.add)

  const seasonsRaw = body.seasons
  const seasons: ClubSeasonValue[] = []
  if (seasonsRaw !== undefined && seasonsRaw !== null) {
    if (!Array.isArray(seasonsRaw)) check.add('seasons', 'Sezone moraju biti niz.')
    else {
      if (seasonsRaw.length > MAX_SEASONS) check.add('seasons', `Najviše ${MAX_SEASONS} sezona.`)
      for (const [index, row] of seasonsRaw.entries()) {
        const parsed = parseSeasonRow(row, index, check.add)
        if (parsed) seasons.push(parsed)
      }
    }
  }

  const sourceIds: string[] = []
  if (body.sourceIds !== undefined && body.sourceIds !== null) {
    if (!Array.isArray(body.sourceIds)) check.add('sourceIds', 'Izvori moraju biti niz.')
    else {
      if (body.sourceIds.length > MAX_SOURCES) check.add('sourceIds', `Najviše ${MAX_SOURCES} izvora.`)
      for (const [index, id] of body.sourceIds.entries()) {
        if (typeof id !== 'string' || !isUuid(id)) check.add(`sourceIds.${index}`, 'Izvor nije valjan.')
        else if (!sourceIds.includes(id)) sourceIds.push(id)
      }
    }
  }

  if (status === 'published' && !sourceIds.length) {
    check.add('sourceIds', 'Klub treba barem jedan izvor.')
  }

  const value: ClubValue = {
    name,
    slug,
    fullName,
    sport,
    settlementId,
    foundedYear,
    homeGround,
    researchNotes,
    verification,
    noindex,
    seasons,
    sourceIds,
    status
  }

  return { value, issues: check.issues }
}

export { HERITAGE_VERIFICATIONS as CLUB_VERIFICATIONS, HERITAGE_VERIFICATION_LABELS as CLUB_VERIFICATION_LABELS }

export function formatSeasonLabel(season: string): string {
  const m = /^(\d{4})\/(\d{2})$/.exec(season)
  if (!m) return season
  return `${m[1]}./${m[2]}.`
}

export function clubSearchFold(name: string, sport: string, fullName: string | null) {
  return contentFold([name, sport, fullName ?? ''].filter(Boolean).join(' '))
}
