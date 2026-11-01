import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import type { AdminWord, WordInput } from '../../shared/utils/word'
import { validateWord, WORD_BODY_LIMIT } from '../../shared/utils/word'
import baseAreas from '../../content/heritage/areas.json'

const WORD_TABLE = 'heritage_words'
// Explicit bridge to the existing sample areas; other catalog places need editorial mapping.
// Never infer a structured settlement's area from its possibly duplicated display name.
const PLACE_AREA_IDS: Record<string, string> = {
  'geonames:3197230': 'hr-kkz-krizevci',
  'geonames:3194024': 'hr-kkz-sveti-petar-orehovec'
}
interface WordRow {
  id: string
  entry: WordInput['entry']
  areas: WordInput['areas']
  active: boolean
  submission_id: number | null
  submission_place: string | null
  created_at: string
  updated_at: string
}

function adminWord(row: WordRow): AdminWord {
  return {
    entry: row.entry, areas: row.areas, active: row.active,
    submissionId: row.submission_id, submissionPlace: row.submission_place,
    createdAt: row.created_at, updatedAt: row.updated_at
  }
}

export function wordIdParam(event: H3Event) {
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[\w~-]{1,200}$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid word id' })
  return id
}

export async function readWordInput(event: H3Event, id: string) {
  const body = await readBody(event).catch(() => null)
  if (Buffer.byteLength(JSON.stringify(body) ?? '') > WORD_BODY_LIMIT) {
    throw createError({ statusCode: 413, statusMessage: 'Word too large' })
  }
  const { value, issues } = validateWord(body, id)
  if (issues.length) throw createError({ statusCode: 400, statusMessage: 'Invalid word', data: { issues } })
  return value
}

export async function listAdminWords(offset: number) {
  const { data, error } = await useDatabaseClient().from(WORD_TABLE).select('*')
    .order('created_at', { ascending: false }).order('id').range(offset, offset + 49)
  if (error) databaseError(error)
  return (data as WordRow[]).map(adminWord)
}

export async function saveWord(input: WordInput, id?: string) {
  const row = { entry: input.entry, areas: input.areas, active: input.active }
  const query = id
    ? useDatabaseClient().from(WORD_TABLE).update(row).eq('id', id)
    : useDatabaseClient().from(WORD_TABLE).insert({ ...row, id: input.entry.id })
  const { data, error } = await query.select('*')
  if (error) databaseError(error)
  if (!data.length) throw createError({ statusCode: 404, statusMessage: 'Word not found' })
  return adminWord(data[0] as WordRow)
}

export async function promoteSubmission(id: number) {
  const client = useDatabaseClient()
  const existing = await client.from(WORD_TABLE).select('*').eq('submission_id', id)
  if (existing.error) databaseError(existing.error)
  if (existing.data.length) return adminWord(existing.data[0] as WordRow)

  // Only the fields needed for a draft are read. Contact never enters the word store.
  const { data, error } = await client.from('heritage_submissions')
    .select('id,text,type,place,place_id,name,consent_publish').eq('id', id)
  if (error) databaseError(error)
  const submission = data[0]
  if (!submission) throw createError({ statusCode: 404, statusMessage: 'Submission not found' })
  if (submission.type === 'correction') throw createError({ statusCode: 400, statusMessage: 'Not a word submission' })
  if (!submission.consent_publish) throw createError({ statusCode: 400, statusMessage: 'Publication consent required' })
  const wordId = randomUUID()
  const isWord = submission.type === 'word' || submission.type === 'expression'
  const headword = isWord ? submission.text.slice(0, 200) : ''
  const area = submission.place_id
    ? baseAreas.find(a => a.id === PLACE_AREA_IDS[submission.place_id])
    : baseAreas.find(a => a.name.toLocaleLowerCase('hr') === submission.place?.toLocaleLowerCase('hr'))
  const draft = validateWord({
    active: false,
    areas: baseAreas,
    entry: {
      headword, meaning: { hr: '' }, partOfSpeech: '', status: 'community',
      examples: !isWord || submission.text.length > 200 ? [{ text: submission.text }] : [],
      // Public source IDs deliberately do not encode the private submission ID.
      sources: [{ id: randomUUID(), kind: 'contribution', ...(submission.name ? { credit: submission.name } : {}) }],
      variants: [{ id: randomUUID(), form: headword, status: 'community', usages: area ? [{ areaId: area.id, confidence: 'reported' }] : [] }]
    }
  }, wordId).value
  const inserted = await client.from(WORD_TABLE).insert({
    id: wordId, entry: draft.entry, areas: draft.areas, active: false,
    submission_id: id, submission_place: submission.place
  }).select('*')
  if (inserted.error) {
    // Unique submission_id makes repeated/concurrent promotion safe and idempotent.
    if (inserted.error.code === '23505') return promoteSubmission(id)
    databaseError(inserted.error)
  }
  return adminWord(inserted.data![0] as WordRow)
}

export async function publicWords(limit: number) {
  const { data, error } = await useDatabaseClient().from(WORD_TABLE)
    .select('id,entry,areas').eq('active', true).order('id').limit(limit)
  if (error) databaseError(error)
  const words: WordInput['entry'][] = []
  const areas = new Map<string, WordInput['areas'][number]>()
  for (const row of data) {
    const parsed = validateWord({ entry: row.entry, areas: row.areas, active: true }, row.id)
    // Fail closed if a direct database edit has left an invalid active entry.
    if (parsed.issues.length) continue
    words.push(parsed.value.entry)
    for (const area of parsed.value.areas) if (!areas.has(area.id)) areas.set(area.id, area)
  }
  return { words, areas: [...areas.values()] }
}
