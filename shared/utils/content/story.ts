import type { ContentEntity, ContentStatus, ContentValidation } from './common'
import { isRecord, issueCollector } from './common'
import type { HeritageVerification } from './heritageItem'
import type { IntangibleLinks, PeriodUnit, RecordedPrecision } from './intangible'
import { INTANGIBLE_LIMITS, hasText, parseIntangibleCommon, parsePeriod, parseRequiredId } from './intangible'

/** A Story (Priča): something people of the region told. Not a heritage item; it may be about one. */
export interface StoryValue extends IntangibleLinks {
  title: string
  slug: string
  typeId: string
  /** The original telling in local speech. */
  textLocal: string | null
  /** A standard Croatian retelling. */
  textStandard: string | null
  /** Set in (Vrijeme radnje): the era the story is set in, in the words people use. */
  period: string | null
  periodUnit: PeriodUnit | null
  periodValue: number | null
  recordedPrecision: RecordedPrecision | null
  recordedYear: number | null
  recordedMonth: number | null
  recordedDay: number | null
  verification: HeritageVerification
  researchNotes: string
  noindex: boolean
  status: ContentStatus
}

export type Story = ContentEntity & StoryValue & {
  typeLabel?: string | null
  placesLabel?: string | null
}

/** Validates and projects a story for the admin API. */
export function validateStory(input: unknown): ContentValidation<StoryValue> {
  const check = issueCollector()
  const body = isRecord(input) ? input : {}
  if (!isRecord(input)) check.add('', 'Podaci priče nedostaju.')

  const common = parseIntangibleCommon(check, body)
  const typeId = parseRequiredId(check.add, 'typeId', body.typeId, 'Odaberite vrstu priče.')
  const textLocal = check.optional('textLocal', body.textLocal, INTANGIBLE_LIMITS.text, 'Izvorni tekst')
  const textStandard = check.optional('textStandard', body.textStandard, INTANGIBLE_LIMITS.text, 'Standardni tekst')
  if (common.status === 'published' && !hasText(textLocal) && !hasText(textStandard)) {
    check.add('textLocal', 'Objavljena priča treba izvorni tekst ili standardni prepričani tekst.')
  }
  const period = parsePeriod(check.add, body, check.optional, 'Vrijeme radnje')

  const value: StoryValue = { ...common, typeId, textLocal, textStandard, ...period }
  return { value, issues: check.issues }
}
