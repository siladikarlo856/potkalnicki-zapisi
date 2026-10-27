import type { H3Event } from 'h3'

const TABLE = 'heritage_submissions'
// Supabase's API returns at most 1000 rows per request (max_rows), so the list is read in pages.
const PAGE_SIZE = 1000

interface SubmissionRow {
  id: number
  text: string
  type: SubmissionType | null
  place: string | null
  name: string | null
  contact: string | null
  consent_publish: boolean
  consent_version: string
  locale: SubmissionLocale
  status: SubmissionStatus
  created_at: string
  reviewed_at: string | null
}

// Postgres returns ISO timestamps; the review page expects UTC "YYYY-MM-DD HH:MM:SS".
function formatTime(value: string) {
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ')
}

function toSubmission(row: SubmissionRow): Submission {
  return {
    id: Number(row.id),
    text: row.text,
    type: row.type,
    place: row.place,
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

// Uses the public (anon) key. Status and created_at are not sent: the table defaults set them,
// and the database only lets this role insert pending submissions with consent.
export async function insertSubmission(input: SubmissionInput) {
  const { error } = await useSubmissionClient().from(TABLE).insert({
    text: input.text,
    type: input.type,
    place: input.place,
    name: input.name,
    contact: input.contact,
    consent_publish: input.consentPublish,
    consent_version: PRIVACY_NOTICE_VERSION,
    locale: input.locale
  })
  if (error) databaseError(error)
}

export async function listSubmissions(status: SubmissionStatus | 'all') {
  const client = useReviewClient()
  const rows: SubmissionRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client.from(TABLE).select('*')
    if (status !== 'all') query = query.eq('status', status)
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) databaseError(error)
    rows.push(...data as SubmissionRow[])
    if (data.length < PAGE_SIZE) break
  }
  return rows.map(toSubmission)
}

export async function setSubmissionStatus(id: number, status: SubmissionStatus) {
  const { data, error } = await useReviewClient()
    .from(TABLE)
    .update({ status, reviewed_at: status === 'pending' ? null : new Date().toISOString() })
    .eq('id', id)
    .select('id')
  if (error) databaseError(error)
  return data.length > 0
}

export async function deleteSubmission(id: number) {
  const { data, error } = await useReviewClient()
    .from(TABLE)
    .delete()
    .eq('id', id)
    .select('id')
  if (error) databaseError(error)
  return data.length > 0
}

export function submissionIdParam(event: H3Event) {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  return id
}
