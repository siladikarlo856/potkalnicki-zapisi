import { randomUUID } from 'node:crypto'
import type { Area } from '../../app/types/heritage'
import type { AdminWord, PublicWordEntry, WordInput } from '../../shared/utils/word'
import { validateWord } from '../../shared/utils/word'
import type { WordPageRelated, WordPageResponse } from '../../shared/types/publicSpeech'
import { wordArchivePagePath } from '../../shared/utils/speech'
import type { Word } from '../../shared/utils/content/word'
import { publishedWords as published } from './content/kinds/word'
import { createDraft, createdFrom, readContent } from './content/records'
import { loadAreaIndex, projectAreas, withProjectedAreas } from './wordAreas'

const WORD_TABLE = 'heritage_words'
const SLUG_HISTORY_TABLE = 'content_slug_history'
const PUBLIC_COLUMNS = 'id,entry,slug,updated_at'
// Only the fields a word Draft is made from. Contact never enters the word store.
const SUBMISSION_COLUMNS = 'id,text,type,intent,place,place_id,name,consent_publish,target_kind,payload'
const AREAS_TABLE = 'areas'

type ResolvedWord
  = | { status: 'ok', value: WordPageResponse }
    | { status: 'redirect', path: string }
    | { status: 'not_found' }

interface WordRow {
  id: string
  entry: WordInput['entry']
  slug?: string | null
}

type Row = Record<string, unknown>

interface AreaRow {
  id: string
  name: string
  kind: string
  parent_id: string | null
  geonames_id: string | null
  official_code: string | null
  status: string
}

function adminWord(word: Word, areas: WordInput['areas']): AdminWord {
  return {
    entry: word.entry, areas, active: word.status === 'published',
    submissionId: word.submissionId, submissionPlace: word.submissionPlace,
    createdAt: word.createdAt, updatedAt: word.updatedAt
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

/**
 * A word Contribution as the value of its word Draft: a word Proposal's payload, or a plain word, expression or
 * memory. Refuses what cannot become a new word. The first variant names the contributor's place as a usage; the
 * place as they wrote it is kept as `submissionPlace`.
 */
async function wordDraftValue(submission: Row): Promise<{ value: Row, origin: Row }> {
  if (submission.type === 'correction') throw createError({ statusCode: 400, statusMessage: 'Not a word submission' })
  // A structured proposal for a new word carries its fields in the payload; a proposal for anything else is no word.
  const proposal = submission.type === 'proposal' && submission.target_kind === 'word'
    ? (submission.payload ?? {}) as Record<string, string | undefined>
    : null
  if (submission.type === 'proposal' && !proposal) throw createError({ statusCode: 400, statusMessage: 'Not a word submission' })
  // "Used in my village too" confirms an existing word; turning it into a draft would duplicate that word.
  if (submission.intent === 'usage') throw createError({ statusCode: 400, statusMessage: 'Usage confirmations are not new words' })
  if (!submission.consent_publish) throw createError({ statusCode: 400, statusMessage: 'Publication consent required' })
  const text = String(submission.text ?? '')
  const isWord = !!proposal || submission.type === 'word' || submission.type === 'expression'
  // A long plain text keeps its start as the headword and the whole as an example; a Proposal's headword is its own.
  const headword = proposal ? proposal.headword ?? '' : isWord ? text.slice(0, 200) : ''
  const placeId = (proposal?.placeId ?? submission.place_id) as string | null | undefined
  const place = submission.place as string | null

  // Map the place (geonames:NNNN) to an area UUID from the database; name match only when no place id was given.
  const area = placeId ? await areaByGeonamesId(placeId) : place ? await areaByName(place) : null
  return {
    value: {
      entry: {
        id: randomUUID(),
        headword, meaning: { hr: proposal?.meaningHr ?? '' }, partOfSpeech: '', status: 'community',
        examples: proposal
          ? (proposal.example ? [{ text: proposal.example }] : [])
          : !isWord || text.length > 200 ? [{ text }] : [],
        // Public source IDs deliberately do not encode the private submission ID.
        sources: [{ id: randomUUID(), kind: 'contribution', ...(submission.name ? { credit: submission.name } : {}) }],
        variants: [{ id: randomUUID(), form: headword, status: 'community', usages: area ? [{ areaId: area.id, confidence: 'reported' }] : [] }]
      }
    },
    origin: { submissionPlace: place ?? null }
  }
}

/**
 * The word Draft of a Contribution (a submission row), saved through the word's own validate → save like an admin
 * create: a value that breaks a word rule is refused (400) and nothing is written. Idempotent per Contribution.
 */
export async function draftWord(submission: Row) {
  const { value, origin } = await wordDraftValue(submission)
  return createDraft('word', value, { submissionId: Number(submission.id), origin })
}

/** The reviewer API's promotion: the Contribution's word Draft (made once), as the admin word it is. */
export async function promoteSubmission(id: number) {
  let wordId = (await createdFrom('word', [id])).get(id)?.id
  if (!wordId) {
    const { data, error } = await useDatabaseClient().from('heritage_submissions').select(SUBMISSION_COLUMNS).eq('id', id).maybeSingle()
    if (error) databaseError(error)
    if (!data) throw createError({ statusCode: 404, statusMessage: 'Submission not found' })
    wordId = (await draftWord(data as Row)).id
  }
  const [word] = await readContent('word', [wordId]) as unknown as Word[]
  return adminWord(word!, projectAreas(word!.entry, await loadAreaIndex(useDatabaseClient())))
}

export async function publicWords(limit?: number) {
  const client = useDatabaseClient()
  const pageSize = 1000
  const words: PublicWordEntry[] = []
  const areas = new Map<string, WordInput['areas'][number]>()
  let from = 0
  while (true) {
    const query = published(client.from(WORD_TABLE).select('id,entry,slug')).order('id')
    if (limit !== undefined && from > 0) break
    const { data, error } = await (limit !== undefined ? query.limit(limit) : query.range(from, from + pageSize - 1))
    if (error) databaseError(error)
    const rows = data ?? []
    for (const row of await withProjectedAreas(client, rows)) {
      const parsed = validateWord({ entry: row.entry, areas: row.areas, active: true }, row.id)
      // Fail closed if a direct database edit has left an invalid active entry.
      if (parsed.issues.length) continue
      const slug = typeof row.slug === 'string' && row.slug ? row.slug : undefined
      if (!slug) console.warn(`publicWords: active word ${row.id} has no slug; skipping archive links`)
      words.push({ ...parsed.value.entry, ...(slug ? { slug } : {}) })
      for (const area of parsed.value.areas) if (!areas.has(area.id)) areas.set(area.id, area)
    }
    if (limit !== undefined || rows.length < pageSize) break
    from += pageSize
  }
  return { words, areas: [...areas.values()] }
}

export interface WordSitemapEntry {
  slug: string
  updatedAt: string
}

/** Slugs for active words that have a public archive page. */
export async function publicWordSitemap(): Promise<WordSitemapEntry[]> {
  const client = useDatabaseClient()
  const pageSize = 1000
  const entries: WordSitemapEntry[] = []
  let from = 0
  while (true) {
    const { data, error } = await published(client.from(WORD_TABLE).select('slug,updated_at'))
      .not('slug', 'is', null)
      .order('slug')
      .range(from, from + pageSize - 1)
    if (error) databaseError(error)
    const rows = data ?? []
    for (const row of rows) {
      const slug = String(row.slug ?? '')
      if (!slug) {
        console.warn('publicWordSitemap: active word row missing slug')
        continue
      }
      entries.push({ slug, updatedAt: String(row.updated_at) })
    }
    if (rows.length < pageSize) break
    from += pageSize
  }
  return entries
}

async function parsedActiveWord(row: WordRow): Promise<{ entry: PublicWordEntry, areas: Area[] } | null> {
  const client = useDatabaseClient()
  const [projected] = await withProjectedAreas(client, [row])
  if (!projected) return null
  const parsed = validateWord({ entry: projected.entry, areas: projected.areas, active: true }, row.id)
  if (parsed.issues.length) return null
  const slug = typeof row.slug === 'string' && row.slug ? row.slug : undefined
  return {
    entry: { ...parsed.value.entry, ...(slug ? { slug } : {}) },
    areas: parsed.value.areas
  }
}

function relatedWords(all: PublicWordEntry[], target: PublicWordEntry, limit = 6): WordPageRelated[] {
  const category = target.category
  const peers = all.filter(w => w.id !== target.id && w.slug && (!category || w.category === category))
  const pool = peers.length ? peers : all.filter(w => w.id !== target.id && w.slug)
  return pool.slice(0, limit).map(w => ({
    slug: w.slug!,
    headword: w.headword,
    meaning: w.meaning.hr,
    path: wordArchivePagePath(w.slug!)
  }))
}

export async function resolvePublicWord(slug: string): Promise<ResolvedWord> {
  const trimmed = slug.trim()
  if (!trimmed) return { status: 'not_found' }

  const client = useDatabaseClient()
  const live = await published(client.from(WORD_TABLE).select(PUBLIC_COLUMNS)).eq('slug', trimmed).limit(1)
  if (live.error) databaseError(live.error)
  const row = live.data?.[0] as WordRow | undefined
  if (row) {
    const parsed = await parsedActiveWord(row)
    if (!parsed?.entry.slug) return { status: 'not_found' }
    const { words } = await publicWords()
    return {
      status: 'ok',
      value: {
        word: parsed.entry,
        areas: parsed.areas,
        related: relatedWords(words, parsed.entry)
      }
    }
  }

  const history = await client.from(SLUG_HISTORY_TABLE)
    .select('entity_id')
    .eq('kind', 'word')
    .eq('namespace', '')
    .is('scope_id', null)
    .eq('slug', trimmed)
    .limit(1)
  if (history.error) databaseError(history.error)
  const entityId = history.data?.[0]?.entity_id
  if (typeof entityId !== 'string' || !entityId) return { status: 'not_found' }

  const current = await published(client.from(WORD_TABLE).select('slug')).eq('id', entityId).limit(1)
  if (current.error) databaseError(current.error)
  const currentSlug = current.data?.[0]?.slug
  if (typeof currentSlug !== 'string' || !currentSlug) return { status: 'not_found' }
  return { status: 'redirect', path: wordArchivePagePath(currentSlug) }
}
