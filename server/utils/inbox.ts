import { randomUUID } from 'node:crypto'
import type { InboxCreated, InboxDetail, InboxDraftResult, InboxFilters, InboxList, InboxRow, InboxTarget } from '../../shared/types/inbox'
import { atlasSlug } from '../../shared/utils/atlasSlug'
import type { ContentStatus } from '../../shared/utils/content/common'
import type { ContributionChange, ContributionKind, ContributionPayload } from '../../shared/utils/contribution'
import { applyWordCorrection, contributionFields, isContributionKind, SOURCE_PROPOSAL_TYPES } from '../../shared/utils/contribution'
import type { SubmissionStatus } from '../../shared/utils/submission'
import { contentKind } from './content/registry'
import { suggestContentSlug } from './content/areaLookup'
import { contentDatabaseError, fail, getContent } from './content/store'
import type { ContentEntityRecord } from './content/store'
import { placeById } from './places'
import type { SubmissionRow } from './submissions'
import { toSubmission } from './submissions'

// The admin side of corrections and proposals: the unified inbox (/admin/prijedlozi), the detail an admin applies
// a correction from, drafts made from proposals, and withdrawal. Applying itself is an ordinary update of the
// target through /api/admin/content/:kind/:id with `applySubmissionId`; see content_apply_submission.

type Row = Record<string, unknown>

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, char => `\\${char}`).replace(/[*,()]/g, ' ')
}

// ---- Targets and created rows ------------------------------------------------------------------------------

const TARGET_SELECT: Record<ContributionKind, { table: string, columns: string, label: (row: Row) => string, status: (row: Row) => ContentStatus }> = {
  word: {
    table: 'heritage_words', columns: 'id,revision,active,archived_at,headword:entry->>headword',
    label: row => String(row.headword ?? ''),
    status: row => row.archived_at ? 'archived' : row.active ? 'published' : 'draft'
  },
  heritage_item: { table: 'heritage_items', columns: 'id,revision,status,name', label: row => String(row.name), status: row => row.status as ContentStatus },
  person: { table: 'persons', columns: 'id,revision,status,name', label: row => String(row.name), status: row => row.status as ContentStatus },
  club: { table: 'clubs', columns: 'id,revision,status,name', label: row => String(row.name), status: row => row.status as ContentStatus },
  area: { table: 'areas', columns: 'id,revision,status,name', label: row => String(row.name), status: row => row.status as ContentStatus },
  source: { table: 'sources', columns: 'id,revision,status,title', label: row => String(row.title), status: row => row.status as ContentStatus }
}

async function readByIds(table: string, columns: string, ids: string[], key = 'id') {
  const rows: Row[] = []
  const unique = [...new Set(ids)]
  for (let from = 0; from < unique.length; from += 100) {
    const { data, error } = await useDatabaseClient().from(table).select(columns).in(key, unique.slice(from, from + 100))
    if (error) databaseError(error)
    rows.push(...(data as unknown as Row[]))
  }
  return rows
}

async function targetsOf(rows: Row[]) {
  const found = new Map<string, InboxTarget>()
  for (const kind of Object.keys(TARGET_SELECT) as ContributionKind[]) {
    const ids = rows.filter(row => row.target_kind === kind && row.target_id).map(row => String(row.target_id))
    if (!ids.length) continue
    const spec = TARGET_SELECT[kind]
    for (const row of await readByIds(spec.table, spec.columns, ids)) {
      found.set(`${kind}:${row.id}`, { kind, id: String(row.id), label: spec.label(row), state: 'ok', status: spec.status(row), revision: Number(row.revision) })
    }
  }
  return found
}

/** Rows an admin has already made from each submission: drafts or published rows (proposals), or a word draft. */
async function createdBy(ids: number[]) {
  const found = new Map<number, InboxCreated>()
  if (!ids.length) return found
  for (const kind of ['heritage_item', 'area', 'source', 'person', 'club'] as const) {
    const spec = TARGET_SELECT[kind]
    for (const row of await readByIds(spec.table, `${spec.columns},source_submission_id`, ids.map(String), 'source_submission_id')) {
      found.set(Number(row.source_submission_id), { kind, id: String(row.id), label: spec.label(row), status: spec.status(row) })
    }
  }
  const spec = TARGET_SELECT.word
  for (const row of await readByIds(spec.table, `${spec.columns},submission_id`, ids.map(String), 'submission_id')) {
    found.set(Number(row.submission_id), { kind: 'word', id: String(row.id), label: spec.label(row), status: spec.status(row) })
  }
  return found
}

function inboxRows(submissions: Awaited<ReturnType<typeof listSubmissionRows>>, targets: Map<string, InboxTarget>, created: Map<number, InboxCreated>): InboxRow[] {
  return submissions.map((submission) => {
    const target = submission.targetKind
      ? targets.get(`${submission.targetKind}:${submission.targetId}`)
      ?? { kind: submission.targetKind, id: submission.targetId, label: '', state: 'missing' as const, status: null, revision: null }
      : null
    const made = created.get(submission.id) ?? null
    const plain = submission.type !== 'correction' && submission.type !== 'proposal'
    return {
      ...submission,
      target,
      created: made,
      canDraft: submission.type === 'proposal' || (plain && submission.intent !== 'usage')
    }
  })
}

async function listSubmissionRows(rows: Row[]) {
  const headwords = new Map<string, string>()
  const wordIds = [...new Set(rows.flatMap(row => row.word_id ? [String(row.word_id)] : []))]
  if (wordIds.length) {
    for (const word of await readByIds('heritage_words', 'id,headword:entry->>headword', wordIds)) headwords.set(String(word.id), String(word.headword ?? ''))
  }
  return rows.map(row => toSubmission(row as unknown as SubmissionRow, headwords))
}

// ---- List ----------------------------------------------------------------------------------------------------

export async function listInbox(filters: InboxFilters): Promise<InboxList> {
  const db = useDatabaseClient()
  let request = db.from('heritage_submissions').select('*', { count: 'exact' })
  if (filters.status !== 'all') request = request.eq('status', filters.status)
  if (filters.type) request = request.eq('type', filters.type)
  if (filters.targetKind) request = request.eq('target_kind', filters.targetKind)
  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`
    request = request.or(`text.ilike.${pattern},name.ilike.${pattern}`)
  }
  const from = (filters.page - 1) * filters.size
  const { data, count, error } = await request.order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + filters.size - 1)
  if (error?.code === 'PGRST103') return { rows: [], total: await countWhere(filters), page: filters.page, size: filters.size, counts: { pending: await pendingCount() } }
  if (error) databaseError(error)
  const rows = (data ?? []) as Row[]
  const submissions = await listSubmissionRows(rows)
  return {
    rows: inboxRows(submissions, await targetsOf(rows), await createdBy(submissions.map(row => row.id))),
    total: count ?? 0,
    page: filters.page,
    size: filters.size,
    counts: { pending: await pendingCount() }
  }
}

async function countWhere(filters: InboxFilters) {
  let request = useDatabaseClient().from('heritage_submissions').select('id', { count: 'exact', head: true })
  if (filters.status !== 'all') request = request.eq('status', filters.status)
  if (filters.type) request = request.eq('type', filters.type)
  if (filters.targetKind) request = request.eq('target_kind', filters.targetKind)
  const { count, error } = await request
  if (error) databaseError(error)
  return count ?? 0
}

export async function pendingCount() {
  const { count, error } = await useDatabaseClient().from('heritage_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  if (error) databaseError(error)
  return count ?? 0
}

async function readSubmissionRow(id: number) {
  const { data, error } = await useDatabaseClient().from('heritage_submissions').select('*').eq('id', id).maybeSingle()
  if (error) databaseError(error)
  if (!data) fail(404, 'Not found', { message: 'Prijedlog nije pronađen.' })
  return data as Row
}

async function inboxRow(id: number) {
  const row = await readSubmissionRow(id)
  const submissions = await listSubmissionRows([row])
  return inboxRows(submissions, await targetsOf([row]), await createdBy([id]))[0]!
}

// ---- Detail: changes and the patch for the edit dialog ---------------------------------------------------------

async function labels(table: 'areas' | 'heritage_categories', ids: string[]) {
  const column = table === 'areas' ? 'name' : 'label_hr'
  const found = new Map<string, string>()
  for (const row of await readByIds(table, `id,${column}`, ids)) found.set(String(row.id), String(row[column]))
  return found
}

async function areaIdByGeonames(placeId: string | undefined) {
  const match = placeId ? /^geonames:(\d+)$/.exec(placeId) : null
  if (!match) return null
  const { data, error } = await useDatabaseClient().from('areas').select('id').eq('geonames_id', match[1]!).eq('status', 'published').limit(1)
  if (error) databaseError(error)
  return (data?.[0]?.id as string | undefined) ?? null
}

function placeName(placeId: string | undefined) {
  if (!placeId) return ''
  const place = placeById(placeId)
  return place ? `${place.name}${place.municipality ? ` · ${place.municipality}` : ''}` : placeId
}

function yearFromText(text: string | undefined, which: 'first' | 'last' = 'first') {
  if (!text) return null
  const years = text.match(/\b(?:1[0-9]{3}|20[0-9]{2})\b/g)
  if (!years) return null
  return Number(which === 'last' ? years[years.length - 1] : years[0])
}

function changeList(kind: ContributionKind, mode: 'correction' | 'proposal', payload: ContributionPayload, current: (key: string) => string | null, shown: (key: string, value: string) => string): ContributionChange[] {
  return contributionFields(kind, mode)
    .filter(field => payload[field.key] !== undefined)
    .map(field => ({
      field: field.key,
      label: field.label,
      current: mode === 'correction' ? current(field.key) : null,
      proposed: shown(field.key, payload[field.key]!),
      applicable: mode === 'correction' && !!field.apply
    }))
}

async function correctionDetail(kind: ContributionKind, targetId: string, payload: ContributionPayload) {
  const { entity } = await getContent(contentKind(kind), targetId)
  const record = entity as ContentEntityRecord & Row
  const ids = { categories: [payload.categoryId].filter(Boolean) as string[], areas: [payload.settlementId, record.settlementId as string | null].filter(Boolean) as string[] }
  const categoryLabels = await labels('heritage_categories', ids.categories)
  const areaLabels = await labels('areas', ids.areas)
  const shown = (key: string, value: string) => {
    if (key === 'categoryId') return categoryLabels.get(value) ?? value
    if (key === 'settlementId') return areaLabels.get(value) ?? value
    if (key === 'variantPlaceId') return placeName(value)
    return value
  }

  if (kind === 'word') {
    const entry = record.entry as { meaning?: { hr?: string, en?: string }, partOfSpeech?: string }
    const current = (key: string) => ({ meaningHr: entry.meaning?.hr, meaningEn: entry.meaning?.en, partOfSpeech: entry.partOfSpeech })[key as 'meaningHr'] ?? null
    const next = applyWordCorrection(record.entry as Parameters<typeof applyWordCorrection>[0], payload, await areaIdByGeonames(payload.variantPlaceId), randomUUID)
    return { changes: changeList(kind, 'correction', payload, current, shown).map(change => ({ ...change, applicable: !['locationHint'].includes(change.field) })), patch: { entry: next } }
  }

  if (kind === 'person') {
    const current = (key: string) => {
      const value = ({
        name: record.name, born: record.born, died: record.died, role: record.role, bio: record.bio
      } as Record<string, unknown>)[key]
      return typeof value === 'string' && value ? value : null
    }
    const patch: Record<string, unknown> = {}
    for (const field of contributionFields(kind, 'correction')) {
      if (field.apply && payload[field.key] !== undefined) patch[field.key] = payload[field.key]
    }
    if (payload.born !== undefined) {
      patch.bornYear = yearFromText(payload.born)
    }
    if (payload.died !== undefined) {
      const year = yearFromText(payload.died, 'last')
      if (year) patch.diedYear = year
    }
    return { changes: changeList(kind, 'correction', payload, current, shown), patch }
  }

  if (kind === 'club') {
    const current = (key: string) => {
      const value = ({ name: record.name, sport: record.sport, competition: null } as Record<string, unknown>)[key]
      return typeof value === 'string' && value ? value : null
    }
    const patch: Record<string, unknown> = {}
    for (const field of contributionFields(kind, 'correction')) {
      if (field.apply && payload[field.key] !== undefined && field.key !== 'competition') patch[field.key] = payload[field.key]
    }
    return { changes: changeList(kind, 'correction', payload, current, shown), patch }
  }

  const current = (key: string) => {
    const value = ({
      name: record.name, categoryId: record.categoryLabel, settlementId: record.settlementId ? areaLabels.get(record.settlementId as string) : null,
      locality: record.locality, period: record.period, description: record.description
    } as Record<string, unknown>)[key]
    return typeof value === 'string' && value ? value : null
  }
  const patch: Record<string, unknown> = {}
  for (const field of contributionFields(kind, 'correction')) {
    if (field.apply && payload[field.key] !== undefined) patch[field.key] = payload[field.key]
  }
  // A new settlement moves the item to that settlement's municipality too.
  if (kind === 'heritage_item' && payload.settlementId) {
    const { data, error } = await useDatabaseClient().from('areas').select('parent_id').eq('id', payload.settlementId).maybeSingle()
    if (error) databaseError(error)
    if (data?.parent_id) patch.municipalityId = data.parent_id
  }
  return { changes: changeList(kind, 'correction', payload, current, shown), patch }
}

export async function inboxDetail(id: number): Promise<InboxDetail> {
  const submission = await inboxRow(id)
  const payload = (submission.payload ?? {}) as ContributionPayload
  if (submission.type === 'correction' && submission.targetKind && submission.targetId && submission.target?.state === 'ok') {
    const { changes, patch } = await correctionDetail(submission.targetKind, submission.targetId, payload)
    return {
      submission, changes, patch,
      stale: submission.baseRevision !== null && submission.target.revision !== null && submission.target.revision > submission.baseRevision
    }
  }
  if (submission.type === 'proposal' && submission.targetKind) {
    const categoryIds = [payload.categoryId].filter(Boolean) as string[]
    const areaIds = [payload.settlementId, payload.municipalityId, payload.parentId].filter(Boolean) as string[]
    const categoryLabels = await labels('heritage_categories', categoryIds)
    const areaLabels = await labels('areas', areaIds)
    const shown = (key: string, value: string) => key === 'categoryId'
      ? categoryLabels.get(value) ?? value
      : ['settlementId', 'municipalityId', 'parentId'].includes(key)
          ? areaLabels.get(value) ?? value
          : key === 'placeId' ? placeName(value) : value
    return { submission, changes: changeList(submission.targetKind, 'proposal', payload, () => null, shown), patch: null, stale: false }
  }
  return { submission, changes: [], patch: null, stale: false }
}

// ---- Status, deletion, bulk ---------------------------------------------------------------------------------------

function refuseApplied(row: Row): void {
  if (row.applied_at) fail(409, 'Applied', { code: 'applied', message: 'Prijedlog je već primijenjen. Možeš ga samo obrisati.' })
}

/** Approve, reject or return to pending. An applied submission keeps its approval: only deletion removes it. */
export async function setInboxStatus(id: number, status: SubmissionStatus) {
  refuseApplied(await readSubmissionRow(id))
  if (!await setSubmissionStatus(id, status)) fail(404, 'Not found', { message: 'Prijedlog nije pronađen.' })
  // Rejecting a proposal unpublishes what was created from it and strips its credit.
  invalidatePublicContent()
}

export async function deleteInbox(id: number) {
  if (!await deleteSubmission(id)) fail(404, 'Not found', { message: 'Prijedlog nije pronađen.' })
  invalidatePublicContent()
}

export const BULK_LIMIT = 100

/** Spam clean-up: reject or delete several at once. Applied submissions are skipped when rejecting. */
export async function bulkInbox(ids: number[], action: 'reject' | 'delete') {
  let done = 0
  let skipped = 0
  for (const id of ids) {
    try {
      if (action === 'delete') await deleteInbox(id)
      else await setInboxStatus(id, 'rejected')
      done++
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 409 || (error as { statusCode?: number }).statusCode === 404) skipped++
      else throw error
    }
  }
  return { done, skipped }
}

// ---- Drafts from proposals -----------------------------------------------------------------------------------------

function staleProposal(): never {
  fail(409, 'Proposal references are gone', { code: 'stale-proposal', message: 'Prijedlog upućuje na zapis koji više ne postoji. Odbij ga ili dodaj zapis ručno.' })
}

async function existingDraft(kind: Exclude<ContributionKind, 'word'>, id: number) {
  const spec = TARGET_SELECT[kind]
  const { data, error } = await useDatabaseClient().from(spec.table).select('id').eq('source_submission_id', id).limit(1)
  if (error) databaseError(error)
  return (data?.[0]?.id as string | undefined) ?? null
}

/**
 * The draft row a proposal turns into, idempotent like `promoteSubmission`: the unique `source_submission_id`
 * makes a repeated or concurrent call return the first draft. Publishing the draft applies the proposal.
 * Words keep their own flow (`promoteSubmission`), which reads the proposal's payload.
 */
export async function draftFromProposal(id: number): Promise<InboxDraftResult> {
  const row = await readSubmissionRow(id)
  const kind = row.target_kind
  const plain = row.type !== 'correction' && row.type !== 'proposal'
  if (row.type === 'correction' || (!plain && !isContributionKind(kind))) fail(400, 'Not a proposal', { message: 'Samo se prijedlozi pretvaraju u skice.' })
  if (row.status === 'rejected') fail(409, 'Rejected', { message: 'Odbijeni prijedlog se ne može pretvoriti u skicu.' })

  if (plain || kind === 'word') {
    const word = await promoteSubmission(id)
    return { kind: 'word', id: word.entry.id, created: true }
  }
  const proposalKind = kind as Exclude<ContributionKind, 'word'>
  const prior = await existingDraft(proposalKind, id)
  if (prior) return { kind: proposalKind, id: prior, created: false }

  const payload = (row.payload ?? {}) as ContributionPayload
  const db = useDatabaseClient()
  let table: string
  let values: Row
  if (proposalKind === 'heritage_item') {
    table = 'heritage_items'
    let municipalityId = payload.municipalityId
    if (payload.settlementId) {
      const { data, error } = await db.from('areas').select('parent_id').eq('id', payload.settlementId).eq('kind', 'settlement').maybeSingle()
      if (error) databaseError(error)
      if (!data?.parent_id) staleProposal()
      municipalityId = data.parent_id as string
    }
    const { data: category, error: categoryError } = await db.from('heritage_categories').select('id').eq('id', payload.categoryId!).maybeSingle()
    if (categoryError) databaseError(categoryError)
    if (!category || !municipalityId) staleProposal()
    values = {
      name: payload.name, slug: await suggestContentSlug(db, table, atlasSlug(payload.name!) || 'zapis', payload.settlementId ?? null),
      category_id: payload.categoryId, municipality_id: municipalityId, settlement_id: payload.settlementId ?? null,
      locality: payload.locality ?? null, description: payload.description ?? null, status: 'draft'
    }
  } else if (proposalKind === 'area') {
    table = 'areas'
    const { data: parent, error } = await db.from('areas').select('id').eq('id', payload.parentId!).in('kind', ['town', 'municipality']).maybeSingle()
    if (error) databaseError(error)
    if (!parent) staleProposal()
    values = {
      kind: 'settlement', parent_id: payload.parentId, name: payload.name,
      slug: await suggestContentSlug(db, table, atlasSlug(payload.name!) || 'naselje', null), status: 'draft'
    }
  } else if (proposalKind === 'person') {
    table = 'persons'
    const { data: settlement, error } = await db.from('areas').select('id').eq('id', payload.settlementId!).eq('kind', 'settlement').maybeSingle()
    if (error) databaseError(error)
    if (!settlement) staleProposal()
    const diedYear = yearFromText(payload.died, 'last')
    const bornYear = yearFromText(payload.born)
    if (!diedYear || (bornYear && bornYear > diedYear)) {
      fail(422, 'Proposal needs a valid year', { code: 'invalid', message: 'Prijedlog nema upotrebljivu godinu smrti. Odbij ga ili dodaj osobu ručno.' })
    }
    const note = [payload.sourceUrl && `Izvor: ${payload.sourceUrl}`, payload.significance].filter(Boolean).join('\n\n')
    values = {
      name: payload.name,
      slug: await suggestContentSlug(db, table, atlasSlug(payload.name!) || 'osoba', null),
      born: payload.born ?? null,
      born_year: bornYear,
      died: payload.died!,
      died_year: diedYear,
      bio: payload.significance ?? null,
      role: (payload.significance ?? '').slice(0, 200),
      research_notes: note,
      status: 'draft'
    }
  } else {
    table = 'sources'
    const note = [payload.author && `Autor: ${payload.author}`, payload.year && `Godina: ${payload.year}`, payload.note].filter(Boolean).join('\n')
    values = {
      title: payload.title, type: (SOURCE_PROPOSAL_TYPES as readonly string[]).includes(payload.type ?? '') ? payload.type : 'other',
      url: payload.url ?? null, note: note || null, status: 'draft'
    }
  }
  const { data, error } = await db.from(table).insert({ ...values, source_submission_id: id }).select('id').single()
  if (error) {
    // A concurrent call made the draft first.
    if (error.code === '23505' && /source_submission_id/.test(error.message)) {
      const again = await existingDraft(proposalKind, id)
      if (again) return { kind: proposalKind, id: again, created: false }
    }
    contentDatabaseError(contentKind(proposalKind), error)
  }
  const createdId = data.id as string
  if (proposalKind === 'person' && payload.settlementId) {
    const { error: linkError } = await db.from('person_areas').insert({
      person_id: createdId, area_id: payload.settlementId, role: 'djelovao', position: 0
    })
    if (linkError) contentDatabaseError(contentKind('person'), linkError)
  }
  invalidatePublicContent()
  return { kind: proposalKind, id: createdId, created: true }
}
