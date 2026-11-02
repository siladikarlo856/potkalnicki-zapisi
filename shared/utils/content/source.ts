import type { ContentEntity, ContentStatus, ContentValidation } from './common'
import { contentStatus, isRecord, issueCollector } from './common'

// Sources (Izvori): registries, studies, dictionaries and other works cited by heritage items.
// The limits and allowed values mirror the `sources` table checks (report Appendix A).

export const SOURCE_TYPES = [
  'official_registry',
  'conservation_study',
  'conservation_document',
  'planning_document',
  'development_document',
  'municipal_source',
  'publication',
  'dictionary',
  'interview',
  'website',
  'other'
] as const
export type SourceType = typeof SOURCE_TYPES[number]

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  official_registry: 'Službeni registar',
  conservation_study: 'Konzervatorska studija',
  conservation_document: 'Konzervatorski dokument',
  planning_document: 'Prostorni plan',
  development_document: 'Razvojni dokument',
  municipal_source: 'Izvor grada ili općine',
  publication: 'Publikacija',
  dictionary: 'Rječnik',
  interview: 'Razgovor',
  website: 'Mrežna stranica',
  other: 'Ostalo'
}

export const SOURCE_LIMITS = { title: 500, url: 1000, note: 2000 } as const

/** The editable fields, as stored. */
export interface SourceValue {
  title: string
  type: SourceType
  url: string | null
  note: string | null
  status: ContentStatus
}

export type Source = ContentEntity & Omit<SourceValue, 'status'>

/** Validates and projects a source: unknown keys are dropped, empty optional text becomes null. */
export function validateSource(input: unknown): ContentValidation<SourceValue> {
  const check = issueCollector()
  const body = isRecord(input) ? input : {}
  if (!isRecord(input)) check.add('', 'Podaci izvora nedostaju.')
  const value: SourceValue = {
    title: check.required('title', body.title, SOURCE_LIMITS.title, 'Naslov'),
    type: check.oneOf('type', body.type, SOURCE_TYPES, 'Vrsta'),
    url: check.url('url', body.url, SOURCE_LIMITS.url, 'Poveznica'),
    note: check.optional('note', body.note, SOURCE_LIMITS.note, 'Napomena'),
    status: contentStatus(body.status, 'published', check.add)
  }
  return { value, issues: check.issues }
}
