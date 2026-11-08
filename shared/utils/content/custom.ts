import type { ContentEntity, ContentStatus, ContentValidation } from './common'
import { isRecord, issueCollector } from './common'
import type { HeritageVerification } from './heritageItem'
import type { IntangibleLinks, PeriodUnit, RecordedPrecision } from './intangible'
import { INTANGIBLE_LIMITS, INTANGIBLE_MAX, hasText, parseIntangibleCommon, parseOptionalId, parsePeriod, parseRequiredId } from './intangible'

/** A Custom (Običaj): something people of the region did, with the occasion it belonged to. Not a heritage item. */
export interface CustomValue extends IntangibleLinks {
  title: string
  slug: string
  typeId: string
  /** The Occasion (Prigoda), e.g. Martinje, when the custom belonged to one. */
  occasionId: string | null
  description: string | null
  /** Short quotes in local speech, in order. */
  quotes: string[]
  /** Practised (Vrijeme prakse): the period the custom was alive, in the words people use. */
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

export type Custom = ContentEntity & CustomValue & {
  typeLabel?: string | null
  occasionLabel?: string | null
  placesLabel?: string | null
}

function parseQuotes(check: ReturnType<typeof issueCollector>, value: unknown) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    check.add('quotes', 'Citati moraju biti popis.')
    return []
  }
  if (value.length > INTANGIBLE_MAX.quotes) check.add('quotes', `Najviše ${INTANGIBLE_MAX.quotes} citata.`)
  const quotes: string[] = []
  for (const [index, entry] of value.entries()) {
    const text = check.optional(`quotes.${index}`, entry, INTANGIBLE_LIMITS.quote, 'Citat')
    if (text) quotes.push(text)
  }
  return quotes
}

/** Validates and projects a custom for the admin API. */
export function validateCustom(input: unknown): ContentValidation<CustomValue> {
  const check = issueCollector()
  const body = isRecord(input) ? input : {}
  if (!isRecord(input)) check.add('', 'Podaci običaja nedostaju.')

  const common = parseIntangibleCommon(check, body)
  const typeId = parseRequiredId(check.add, 'typeId', body.typeId, 'Odaberite vrstu običaja.')
  const occasionId = parseOptionalId(check.add, 'occasionId', body.occasionId, 'Prigoda')
  const description = check.optional('description', body.description, INTANGIBLE_LIMITS.text, 'Opis')
  if (common.status === 'published' && !hasText(description)) check.add('description', 'Objavljen običaj treba opis.')
  const period = parsePeriod(check.add, body, check.optional, 'Vrijeme prakse')

  const value: CustomValue = { ...common, typeId, occasionId, description, quotes: parseQuotes(check, body.quotes), ...period }
  return { value, issues: check.issues }
}
