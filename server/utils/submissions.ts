import type { H3Event } from 'h3'
import { heritageItemById } from '~~/shared/utils/atlasData'
import { placeById } from './places'

const TABLE = 'heritage_submissions'
// Supabase's API returns at most 1000 rows per request (max_rows), so the list is read in pages.
const PAGE_SIZE = 1000

interface SubmissionRow {
  id: number
  text: string
  type: SubmissionType | null
  place: string | null
  place_id: string | null
  place_catalog_version: string | null
  target_ref: string | null
  word_id?: string | null
  intent?: SubmissionIntent | null
  name: string | null
  contact: string | null
  consent_publish: boolean
  consent_version: string
  locale: SubmissionLocale
  status: SubmissionStatus
  created_at: string
  reviewed_at: string | null
}

function placeContext(id: string) {
  const place = placeById(id)
  return place ? `${place.municipality} · ${place.county}` : null
}

export interface ResolvedSubmissionInput extends SubmissionInput {
  place: string | null
  placeCatalogVersion: string | null
}

// Postgres returns ISO timestamps; the review page expects UTC "YYYY-MM-DD HH:MM:SS".
function formatTime(value: string) {
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ')
}

function toSubmission(row: SubmissionRow, headwords: ReadonlyMap<string, string>): Submission {
  return {
    id: Number(row.id),
    text: row.text,
    type: row.type,
    targetRef: row.target_ref ?? null,
    wordId: row.word_id ?? null,
    intent: row.intent ?? null,
    wordHeadword: row.word_id ? headwords.get(row.word_id) ?? null : null,
    place: row.place,
    placeId: row.place_id ?? null,
    placeCatalogVersion: row.place_catalog_version ?? null,
    placeContext: row.place_id ? placeContext(row.place_id) : null,
    name: row.name,
    contact: row.contact,
    consentPublish: row.consent_publish,
    consentVersion: row.consent_version,
    locale: row.locale,
    status: row.status,
    createdAt: formatTime(row.created_at),
    reviewedAt: row.reviewed_at ? formatTime(row.reviewed_at) : null
  }
}

// The route validates input before insertion. Status and created_at use table defaults;
// the shared server-only secret key bypasses RLS, while check constraints still apply.
export async function insertSubmission(input: ResolvedSubmissionInput) {
  const { error } = await useDatabaseClient().from(TABLE).insert({
    text: input.text,
    type: input.type,
    target_ref: input.targetRef,
    place: input.place,
    place_id: input.placeId,
    place_catalog_version: input.placeCatalogVersion,
    name: input.name,
    contact: input.contact,
    consent_publish: input.consentPublish,
    consent_version: PRIVACY_NOTICE_VERSION,
    locale: input.locale,
    // Only sent when set, so ordinary submissions still work before the word-link migration is applied.
    ...(input.wordId ? { word_id: input.wordId, intent: input.intent } : {})
  })
  if (error) databaseError(error)
}

export async function listSubmissions(status: SubmissionStatus | 'all', type?: SubmissionType) {
  const client = useDatabaseClient()
  const rows: SubmissionRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client.from(TABLE).select('*')
    if (status !== 'all') query = query.eq('status', status)
    if (type) query = query.eq('type', type)
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) databaseError(error)
    rows.push(...data as SubmissionRow[])
    if (data.length < PAGE_SIZE) break
  }
  const headwords = await linkedHeadwords(rows.flatMap(row => row.word_id ? [row.word_id] : []))
  return rows.map(row => toSubmission(row, headwords))
}

// Review shows which word a contribution is about, so the headwords of the linked words are read in one go.
async function linkedHeadwords(ids: string[]) {
  const headwords = new Map<string, string>()
  const unique = [...new Set(ids)]
  for (let from = 0; from < unique.length; from += 100) {
    const { data, error } = await useDatabaseClient().from('heritage_words').select('id,entry').in('id', unique.slice(from, from + 100))
    if (error) databaseError(error)
    for (const word of data as Array<{ id: string, entry: { headword?: unknown } }>) {
      if (typeof word.entry?.headword === 'string') headwords.set(word.id, word.entry.headword)
    }
  }
  return headwords
}

// Contributions from the daily word may only point at a word that is live, so nobody can attach text to a draft.
export async function assertActiveWord(id: string, locale: unknown) {
  const { data, error } = await useDatabaseClient().from('heritage_words').select('id').eq('id', id).eq('active', true)
  if (error) databaseError(error)
  if (!data.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid submission',
      data: { issues: [{ field: 'wordId', code: 'invalid', message: locale === 'en' ? 'This word is no longer available.' : 'Ova riječ više nije dostupna.' }] }
    })
  }
}

export async function setSubmissionStatus(id: number, status: SubmissionStatus) {
  const { data, error } = await useDatabaseClient()
    .from(TABLE)
    .update({ status, reviewed_at: status === 'pending' ? null : new Date().toISOString() })
    .eq('id', id)
    .select('id')
  if (error) databaseError(error)
  return data.length > 0
}

export async function deleteSubmission(id: number) {
  const { data, error } = await useDatabaseClient()
    .from(TABLE)
    .delete()
    .eq('id', id)
    .select('id')
  if (error) databaseError(error)
  return data.length > 0
}

export function assertKnownCorrectionTarget(targetRef: string) {
  if (!heritageItemById(targetRef)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid submission',
      data: { issues: [{ field: 'targetRef', code: 'invalid' }] }
    })
  }
}

export function submissionIdParam(event: H3Event) {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  return id
}
