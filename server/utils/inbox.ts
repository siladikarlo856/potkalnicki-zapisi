import { randomUUID } from 'node:crypto'
import type { InboxCreated, InboxDetail, InboxDraftResult, InboxFilters, InboxList, InboxRow, InboxTarget } from '../../shared/types/inbox'
import { atlasSlug } from '../../shared/utils/atlasSlug'
import type { ContributionChange, ContributionKind, ContributionPayload } from '../../shared/utils/contribution'
import { applyWordCorrection, CONTRIBUTION_KINDS, contributionFields, isContributionKind, SOURCE_PROPOSAL_TYPES } from '../../shared/utils/contribution'
import type { SubmissionStatus } from '../../shared/utils/submission'
import { contentKind } from './content/registry'
import { createDraft, createdFrom, findPublished, readContent, suggestSlug } from './content/records'
import { fail, getContent } from './content/store'
import type { ContentEntityRecord } from './content/store'
import { placeById } from './places'
import type { SubmissionRow } from './submissions'
import { linkedHeadwords, toSubmission } from './submissions'
import { draftWord } from './words'

// The admin side of corrections and proposals: the unified inbox (/admin/prijedlozi), the detail an admin applies
// a correction from, drafts made from proposals, and withdrawal. Applying itself is an ordinary update of the
// target through /api/admin/content/:kind/:id with `applySubmissionId`; see content_apply_submission.

type Row = Record<string, unknown>

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, char => `\\${char}`).replace(/[*,()]/g, ' ')
}

// ---- Targets and created rows ------------------------------------------------------------------------------

/** What each Correction points at, as it is now (a row that is gone is left out). */
async function targetsOf(rows: Row[]) {
  const found = new Map<string, InboxTarget>()
  for (const kind of CONTRIBUTION_KINDS) {
    const ids = rows.filter(row => row.target_kind === kind && row.target_id).map(row => String(row.target_id))
    if (!ids.length) continue
    for (const record of await readContent(kind, ids)) {
      found.set(`${kind}:${record.id}`, { kind, id: record.id, label: record.label, state: 'ok', status: record.status, revision: Number(record.revision) })
    }
  }
  return found
}

/** Rows an admin has already made from each submission: drafts or published rows (proposals), or a word draft. */
async function createdBy(ids: number[]) {
  const found = new Map<number, InboxCreated>()
  if (!ids.length) return found
  for (const kind of CONTRIBUTION_KINDS) {
    for (const [submissionId, record] of await createdFrom(kind, ids)) {
      found.set(submissionId, { kind, id: record.id, label: record.label, status: record.status })
    }
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
  const headwords = await linkedHeadwords(rows.flatMap(row => row.word_id ? [String(row.word_id)] : []))
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

async function labels(kind: 'area' | 'heritage_category', ids: string[]) {
  return new Map((await readContent(kind, ids)).map(record => [record.id, record.label]))
}

async function areaIdByGeonames(placeId: string | undefined) {
  const match = placeId ? /^geonames:(\d+)$/.exec(placeId) : null
  if (!match) return null
  return (await findPublished('area', { geonamesId: match[1]! }))?.id ?? null
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
  const categoryLabels = await labels('heritage_category', ids.categories)
  const areaLabels = await labels('area', ids.areas)
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
    const [settlement] = await readContent('area', [payload.settlementId])
    if (settlement?.parentId) patch.municipalityId = settlement.parentId
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
    const categoryLabels = await labels('heritage_category', categoryIds)
    const areaLabels = await labels('area', areaIds)
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

/** A row of the kind (any status), or null: a Draft built from a Proposal must point at rows that still exist. */
async function existing(kind: 'area' | 'heritage_category', id: string | undefined) {
  if (!id) return null
  return (await readContent(kind, [id]))[0] ?? null
}

/**
 * The Draft a Proposal turns into: its payload mapped to the kind's fields and saved through the kind's own
 * validation and save (`createDraft`), as an admin create is. Idempotent: a repeated or concurrent call returns
 * the first Draft. Publishing the Draft applies the Proposal. A plain word, expression or memory becomes a word
 * Draft the same way (`draftWord`).
 */
export async function draftFromProposal(id: number): Promise<InboxDraftResult> {
  const row = await readSubmissionRow(id)
  const kind = row.target_kind
  const plain = row.type !== 'correction' && row.type !== 'proposal'
  if (row.type === 'correction' || (!plain && !isContributionKind(kind))) fail(400, 'Not a proposal', { message: 'Samo se prijedlozi pretvaraju u skice.' })
  if (row.status === 'rejected') fail(409, 'Rejected', { message: 'Odbijeni prijedlog se ne može pretvoriti u skicu.' })

  const draftKind = plain ? 'word' : kind as ContributionKind
  const prior = (await createdFrom(draftKind, [id])).get(id)
  if (prior) return { kind: draftKind, id: prior.id, created: false }
  if (draftKind === 'word') return { kind: 'word', ...await draftWord(row) }
  const draft = await createDraft(draftKind, await draftValue(draftKind, (row.payload ?? {}) as ContributionPayload), { submissionId: id })
  return { kind: draftKind, ...draft }
}

/** A Proposal's payload as the API fields of its kind. */
async function draftValue(kind: Exclude<ContributionKind, 'word'>, payload: ContributionPayload): Promise<Row> {
  if (kind === 'heritage_item') {
    let municipalityId = payload.municipalityId
    if (payload.settlementId) {
      const settlement = await existing('area', payload.settlementId)
      if (settlement?.kind !== 'settlement' || !settlement.parentId) staleProposal()
      municipalityId = settlement.parentId as string
    }
    if (!await existing('heritage_category', payload.categoryId) || !municipalityId) staleProposal()
    return {
      name: payload.name,
      slug: await suggestSlug(kind, atlasSlug(payload.name!) || 'zapis', payload.settlementId ?? null),
      categoryId: payload.categoryId,
      municipalityId,
      settlementId: payload.settlementId ?? null,
      locality: payload.locality ?? null,
      description: payload.description ?? null,
      verification: 'unverified',
      researchNotes: '',
      sourceIds: []
    }
  }
  if (kind === 'area') {
    const parent = await existing('area', payload.parentId)
    if (parent?.kind !== 'town' && parent?.kind !== 'municipality') staleProposal()
    return {
      kind: 'settlement',
      parentId: payload.parentId,
      name: payload.name,
      slug: await suggestSlug(kind, atlasSlug(payload.name!) || 'naselje', null),
      regionIds: []
    }
  }
  if (kind === 'person') {
    if ((await existing('area', payload.settlementId))?.kind !== 'settlement') staleProposal()
    const diedYear = yearFromText(payload.died, 'last')
    const bornYear = yearFromText(payload.born)
    if (!diedYear || (bornYear && bornYear > diedYear)) {
      fail(422, 'Proposal needs a valid year', { code: 'invalid', message: 'Prijedlog nema upotrebljivu godinu smrti. Odbij ga ili dodaj osobu ručno.' })
    }
    const note = [payload.sourceUrl && `Izvor: ${payload.sourceUrl}`, payload.significance].filter(Boolean).join('\n\n')
    return {
      name: payload.name,
      slug: await suggestSlug(kind, atlasSlug(payload.name!) || 'osoba', null),
      born: payload.born ?? null,
      bornYear,
      died: payload.died!,
      diedYear,
      bio: payload.significance ?? null,
      role: (payload.significance ?? '').slice(0, 200),
      researchNotes: note,
      verification: 'unverified',
      areaLinks: [{ areaId: payload.settlementId, role: 'djelovao' }],
      itemLinks: [],
      sourceIds: []
    }
  }
  if (kind === 'source') {
    const note = [payload.author && `Autor: ${payload.author}`, payload.year && `Godina: ${payload.year}`, payload.note].filter(Boolean).join('\n')
    return {
      title: payload.title,
      type: (SOURCE_PROPOSAL_TYPES as readonly string[]).includes(payload.type ?? '') ? payload.type : 'other',
      url: payload.url ?? null,
      note: note || null
    }
  }
  fail(400, 'Not a proposal', { message: 'Samo se prijedlozi pretvaraju u skice.' })
}
