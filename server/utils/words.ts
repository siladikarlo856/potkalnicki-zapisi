import { randomUUID } from 'node:crypto'
import type { AdminWord, WordInput } from '../../shared/utils/word'
import { validateWord } from '../../shared/utils/word'
import { loadAreaIndex, projectAreas, withProjectedAreas } from './wordAreas'

const WORD_TABLE = 'heritage_words'
// The columns a word draft is read back with; heritage_words.areas is never read (see wordAreas.ts).
const ADMIN_COLUMNS = 'id,entry,active,submission_id,submission_place,created_at,updated_at'
const AREAS_TABLE = 'areas'

interface WordRow {
  id: string
  entry: WordInput['entry']
  active: boolean
  submission_id: number | null
  submission_place: string | null
  created_at: string
  updated_at: string
}

interface AreaRow {
  id: string
  name: string
  kind: string
  parent_id: string | null
  geonames_id: string | null
  official_code: string | null
  status: string
}

function adminWord(row: WordRow, areas: WordInput['areas']): AdminWord {
  return {
    entry: row.entry, areas, active: row.active,
    submissionId: row.submission_id, submissionPlace: row.submission_place,
    createdAt: row.created_at, updatedAt: row.updated_at
  }
}

/** Look up an area by its GeoNames id (e.g. 'geonames:3197230') from the areas table. */
async function areaByGeonamesId(placeId: string): Promise<AreaRow | null> {
  // submission.place_id is stored as 'geonames:<numeric id>'
  const match = /^geonames:(\d+)$/.exec(placeId)
  if (!match) return null
  const geonamesId = match[1]!
  const { data, error } = await useDatabaseClient()
    .from(AREAS_TABLE)
    .select('id,name,kind,parent_id,geonames_id,official_code,status')
    .eq('geonames_id', geonamesId)
    .eq('status', 'published')
    .limit(1)
  if (error || !data?.length) return null
  return data[0] as AreaRow
}

/** Look up an area by display name (case-insensitive Croatian locale). */
async function areaByName(placeName: string): Promise<AreaRow | null> {
  const { data, error } = await useDatabaseClient()
    .from(AREAS_TABLE)
    .select('id,name,kind,parent_id,geonames_id,official_code,status')
    .eq('status', 'published')
    .ilike('name', placeName.replace(/[\\%_]/g, '\\$&'))
    .limit(2)
  if (error || data?.length !== 1) return null
  return data[0] as AreaRow
}

/**
 * Fetch the published areas list for the admin area picker: all published areas ordered by
 * kind (country → county → region → town/municipality → settlement) then by name.
 */
export async function listAdminAreas() {
  const KIND_ORDER: Record<string, number> = { country: 0, county: 1, region: 2, town: 3, municipality: 3, settlement: 4 }
  const { data, error } = await useDatabaseClient()
    .from(AREAS_TABLE)
    .select('id,name,kind,parent_id,geonames_id,official_code,status')
    .eq('status', 'published')
    .order('name')
  if (error) databaseError(error)
  const rows = (data as AreaRow[]).slice().sort((a, b) =>
    (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9) || a.name.localeCompare(b.name, 'hr'))
  return rows.map(r => ({
    id: r.id, name: r.name, kind: r.kind, parentId: r.parent_id ?? null,
    externalIds: { ...(r.geonames_id ? { geonames: r.geonames_id } : {}), ...(r.official_code ? { dgu: r.official_code } : {}) }
  }))
}

export async function promoteSubmission(id: number) {
  const client = useDatabaseClient()
  const existing = await client.from(WORD_TABLE).select(ADMIN_COLUMNS).eq('submission_id', id)
  if (existing.error) databaseError(existing.error)
  if (existing.data.length) return adminWord(existing.data[0] as unknown as WordRow, projectAreas(existing.data[0]!.entry, await loadAreaIndex(client)))

  // Only the fields needed for a draft are read. Contact never enters the word store.
  const { data, error } = await client.from('heritage_submissions')
    .select('id,text,type,intent,place,place_id,name,consent_publish,target_kind,payload').eq('id', id)
  if (error) databaseError(error)
  const submission = data[0]
  if (!submission) throw createError({ statusCode: 404, statusMessage: 'Submission not found' })
  if (submission.type === 'correction') throw createError({ statusCode: 400, statusMessage: 'Not a word submission' })
  // A structured proposal for a new word carries its fields in the payload; a proposal for anything else is no word.
  const proposal = submission.type === 'proposal' && submission.target_kind === 'word'
    ? (submission.payload ?? {}) as Record<string, string | undefined>
    : null
  if (submission.type === 'proposal' && !proposal) throw createError({ statusCode: 400, statusMessage: 'Not a word submission' })
  // "Used in my village too" confirms an existing word; turning it into a draft would duplicate that word.
  if (submission.intent === 'usage') throw createError({ statusCode: 400, statusMessage: 'Usage confirmations are not new words' })
  if (!submission.consent_publish) throw createError({ statusCode: 400, statusMessage: 'Publication consent required' })
  const wordId = randomUUID()
  const isWord = !!proposal || submission.type === 'word' || submission.type === 'expression'
  const headword = proposal ? (proposal.headword ?? '').slice(0, 200) : isWord ? submission.text.slice(0, 200) : ''
  const placeId = proposal?.placeId ?? submission.place_id

  // Map the place (geonames:NNNN) to an area UUID from the database; name match only when no place id was given.
  let areaId: string | undefined
  if (placeId) {
    const area = await areaByGeonamesId(placeId)
    if (area) areaId = area.id
  } else if (submission.place) {
    const area = await areaByName(submission.place)
    if (area) areaId = area.id
  }

  // The draft names its area in the first variant's usage; the areas themselves are read from the areas table.
  const draft = validateWord({
    active: false,
    areas: [],
    entry: {
      headword, meaning: { hr: proposal?.meaningHr ?? '' }, partOfSpeech: '', status: 'community',
      examples: proposal
        ? (proposal.example ? [{ text: proposal.example }] : [])
        : !isWord || submission.text.length > 200 ? [{ text: submission.text }] : [],
      // Public source IDs deliberately do not encode the private submission ID.
      sources: [{ id: randomUUID(), kind: 'contribution', ...(submission.name ? { credit: submission.name } : {}) }],
      variants: [{ id: randomUUID(), form: headword, status: 'community', usages: areaId ? [{ areaId, confidence: 'reported' }] : [] }]
    }
  }, wordId).value
  const inserted = await client.from(WORD_TABLE).insert({
    id: wordId, entry: draft.entry, active: false,
    submission_id: id, submission_place: submission.place
  }).select(ADMIN_COLUMNS)
  if (inserted.error) {
    // Unique submission_id makes repeated/concurrent promotion safe and idempotent.
    if (inserted.error.code === '23505') return promoteSubmission(id)
    databaseError(inserted.error)
  }
  return adminWord(inserted.data![0] as unknown as WordRow, projectAreas(draft.entry, await loadAreaIndex(client)))
}

export async function publicWords(limit: number) {
  const client = useDatabaseClient()
  const { data, error } = await client.from(WORD_TABLE)
    .select('id,entry').eq('active', true).order('id').limit(limit)
  if (error) databaseError(error)
  const words: WordInput['entry'][] = []
  const areas = new Map<string, WordInput['areas'][number]>()
  for (const row of await withProjectedAreas(client, data)) {
    const parsed = validateWord({ entry: row.entry, areas: row.areas, active: true }, row.id)
    // Fail closed if a direct database edit has left an invalid active entry.
    if (parsed.issues.length) continue
    words.push(parsed.value.entry)
    for (const area of parsed.value.areas) if (!areas.has(area.id)) areas.set(area.id, area)
  }
  return { words, areas: [...areas.values()] }
}
