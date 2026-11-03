import type { Area, WordEntry } from '../../../app/types/heritage'
import type { ContentEntity, ContentIssue, ContentStatus, ContentValidation } from './common'
import { contentStatus, isRecord } from './common'
import { validateWord, WORD_BODY_LIMIT } from '../word'

export { WORD_BODY_LIMIT }

/** Editable word payload for the admin content API and dialog. */
export interface WordValue {
  entry: WordEntry
  areas: Area[]
  status: ContentStatus
}

/** One row in the admin word list and in GET/PATCH responses. */
export type Word = ContentEntity & WordValue & {
  slug: string | null
  headword: string
  meaningHr: string
  entryStatus: WordEntry['status']
  submissionId: number | null
  submissionPlace: string | null
}

function mapWordIssues(issues: string[]): ContentIssue[] {
  return issues.map((message) => {
    const colon = message.indexOf(': ')
    if (colon === -1) return { path: '', message }
    return { path: message.slice(0, colon), message: message.slice(colon + 2) }
  })
}

export function wordStatusToActive(status: ContentStatus): boolean {
  return status === 'published'
}

export function wordActiveToStatus(active: boolean, archivedAt: string | null | undefined): ContentStatus {
  if (archivedAt) return 'archived'
  return active ? 'published' : 'draft'
}

/** Maps content `status` to `active` and runs the shared word validator. */
export function validateAdminWord(input: unknown, id?: string): ContentValidation<WordValue> {
  const issues: ContentIssue[] = []
  const body = isRecord(input) ? input : {}
  if (!isRecord(input)) issues.push({ path: '', message: 'Podaci riječi nedostaju.' })
  const entryRecord = isRecord(body.entry) ? body.entry : {}
  const wordId = (typeof id === 'string' && id)
    || (typeof entryRecord.id === 'string' && entryRecord.id)
    || crypto.randomUUID()
  const status = contentStatus(body.status, 'draft', (path, message) => issues.push({ path, message }))
  const active = wordStatusToActive(status)
  const parsed = validateWord({ entry: body.entry, areas: body.areas, active }, wordId)
  issues.push(...mapWordIssues(parsed.issues))
  return { value: { entry: parsed.value.entry, areas: parsed.value.areas, status }, issues }
}

export function projectWordRow(row: {
  id: string
  entry: WordEntry
  areas: Area[]
  active: boolean
  archived_at: string | null
  slug: string | null
  revision: number
  created_at: string
  updated_at: string
  submission_id: number | null
  submission_place: string | null
}): Word {
  return {
    id: row.id,
    entry: row.entry,
    areas: row.areas,
    status: wordActiveToStatus(row.active, row.archived_at),
    slug: row.slug,
    headword: row.entry.headword || '',
    meaningHr: row.entry.meaning?.hr ?? '',
    entryStatus: row.entry.status,
    submissionId: row.submission_id,
    submissionPlace: row.submission_place,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}
