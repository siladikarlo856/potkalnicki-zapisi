import type { ContentEntity, ContentStatus, ContentValidation } from './common'
import { isRecord, issueCollector } from './common'
import type { HeritageVerification } from './heritageItem'
import type { IntangibleLinks, RecordedPrecision } from './intangible'
import { INTANGIBLE_LIMITS, INTANGIBLE_MAX, hasText, parseIntangibleCommon, parseOptionalId, parseRequiredId } from './intangible'

/**
 * A Folk text (Usmeni tekst): a short fixed text people said or sang, where the exact wording is the record. It may
 * link to the dialect Words it contains and to the Custom it belonged to ("said or sung when").
 */
export interface FolkTextValue extends IntangibleLinks {
  title: string
  slug: string
  typeId: string
  /** The Custom (Običaj) it was said or sung at. */
  customId: string | null
  /** The exact wording in local speech. */
  textLocal: string | null
  /** A standard Croatian retelling or rendering. */
  textStandard: string | null
  /** The Words (heritage_words ids) it contains. */
  wordIds: string[]
  recordedPrecision: RecordedPrecision | null
  recordedYear: number | null
  recordedMonth: number | null
  recordedDay: number | null
  verification: HeritageVerification
  researchNotes: string
  noindex: boolean
  status: ContentStatus
}

export type FolkText = ContentEntity & FolkTextValue & {
  typeLabel?: string | null
  customLabel?: string | null
  placesLabel?: string | null
}

function parseWordIds(check: ReturnType<typeof issueCollector>, value: unknown) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    check.add('wordIds', 'Riječi moraju biti popis identifikatora.')
    return []
  }
  if (value.length > INTANGIBLE_MAX.words) check.add('wordIds', `Najviše ${INTANGIBLE_MAX.words} riječi.`)
  const ids: string[] = []
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string' || !entry.trim() || entry.length > INTANGIBLE_LIMITS.wordId) check.add(`wordIds.${index}`, 'Riječ nije valjana.')
    else if (!ids.includes(entry)) ids.push(entry)
  }
  return ids
}

/** Validates and projects a folk text for the admin API. */
export function validateFolkText(input: unknown): ContentValidation<FolkTextValue> {
  const check = issueCollector()
  const body = isRecord(input) ? input : {}
  if (!isRecord(input)) check.add('', 'Podaci usmenog teksta nedostaju.')

  const common = parseIntangibleCommon(check, body)
  const typeId = parseRequiredId(check.add, 'typeId', body.typeId, 'Odaberite vrstu usmenog teksta.')
  const customId = parseOptionalId(check.add, 'customId', body.customId, 'Običaj')
  const textLocal = check.optional('textLocal', body.textLocal, INTANGIBLE_LIMITS.text, 'Izvorni tekst')
  const textStandard = check.optional('textStandard', body.textStandard, INTANGIBLE_LIMITS.text, 'Standardni tekst')
  if (common.status === 'published' && !hasText(textLocal) && !hasText(textStandard)) {
    check.add('textLocal', 'Objavljen usmeni tekst treba izvorni tekst ili standardni tekst.')
  }

  const value: FolkTextValue = { ...common, typeId, customId, textLocal, textStandard, wordIds: parseWordIds(check, body.wordIds) }
  return { value, issues: check.issues }
}
