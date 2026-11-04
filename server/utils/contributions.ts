import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import type { ContributionKind, ContributionPayload } from '../../shared/utils/contribution'
import { CONTRIBUTION_LINK_LIMIT, totalLinks, UUID_PATTERN } from '../../shared/utils/contribution'
import type { SubmissionInput } from '../../shared/utils/submission'

// The public side of corrections and proposals: resolving what a correction is about, and the spam
// hardening that sits on top of the existing honeypot, per-IP limit and 16 KB cap (README, "Corrections
// and proposals"): per-target throttle, duplicate fingerprint, link cap, minimum fill time, pending cap.

const LEGACY_KINDS: Partial<Record<ContributionKind, string>> = { heritage_item: 'heritage_item', area: 'area', source: 'source', person: 'person' }

export interface ContributionTarget {
  id: string
  revision: number
}

/**
 * The published row a correction is about, by UUID or (for heritage items, settlements and sources) an old
 * id. Words are matched by their UUID text id. Returns null for anything unknown, unpublished, archived or,
 * for areas, not a settlement: only published content takes a correction.
 */
export async function resolveContributionTarget(kind: ContributionKind, value: string): Promise<ContributionTarget | null> {
  const db = useDatabaseClient()
  let id = value.toLowerCase()
  if (!UUID_PATTERN.test(id)) {
    const legacyKind = LEGACY_KINDS[kind]
    if (!legacyKind) return null
    const { data, error } = await db.from('content_legacy_ids').select('entity_id').eq('kind', legacyKind).eq('legacy_id', id).maybeSingle()
    if (error) databaseError(error)
    if (!data) return null
    id = String(data.entity_id)
  }
  const table = { word: 'heritage_words', heritage_item: 'heritage_items', area: 'areas', source: 'sources', person: 'persons' }[kind]
  let request = db.from(table).select('id,revision').eq('id', id)
  if (kind === 'word') request = request.eq('active', true)
  else request = request.eq('status', 'published')
  if (kind === 'area') request = request.eq('kind', 'settlement')
  const { data, error } = await request.limit(1)
  if (error) databaseError(error)
  const row = data?.[0] as { id: string, revision: number } | undefined
  return row ? { id: row.id, revision: Number(row.revision) } : null
}

/** Settlements and categories a proposal names must exist and be public, so a draft can be built from it. */
export async function assertPublishedRows(table: 'areas' | 'heritage_categories', ids: string[], kinds?: string[]) {
  if (!ids.length) return true
  let request = useDatabaseClient().from(table).select('id').in('id', ids).eq('status', 'published')
  if (kinds) request = request.in('kind', kinds)
  const { data, error } = await request
  if (error) databaseError(error)
  return (data?.length ?? 0) === new Set(ids).size
}

// ---- Minimum fill time: a signed render-time token --------------------------------------------------------

const TOKEN_MIN_SECONDS = 3
const TOKEN_MAX_SECONDS = 24 * 60 * 60

function tokenKey(event: H3Event) {
  const { adminSessionPassword, reviewSecret } = useRuntimeConfig(event)
  const secret = adminSessionPassword || reviewSecret
  return secret ? createHmac('sha256', String(secret)).update('submission-form-token').digest() : null
}

const sign = (key: Buffer, issuedAt: string) => createHmac('sha256', key).update(issuedAt).digest('base64url')

/** `<unix seconds>.<signature>`: the form fetches one when it renders and sends it back with the submission. */
export function issueFormToken(event: H3Event, now = Date.now()) {
  const key = tokenKey(event)
  if (!key) return null
  const issuedAt = String(Math.floor(now / 1000))
  return `${issuedAt}.${sign(key, issuedAt)}`
}

export type FormTokenState = 'ok' | 'too-fast' | 'expired' | 'invalid' | 'unchecked'

/** `unchecked` when the server has no secret to sign with (local development); otherwise a forged or missing token is `invalid`. */
export function checkFormToken(event: H3Event, token: unknown, now = Date.now()): FormTokenState {
  const key = tokenKey(event)
  if (!key) return 'unchecked'
  if (typeof token !== 'string') return 'invalid'
  const [issuedAt, signature, ...rest] = token.split('.')
  if (!issuedAt || !signature || rest.length || !/^\d{1,12}$/.test(issuedAt)) return 'invalid'
  const expected = Buffer.from(sign(key, issuedAt))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return 'invalid'
  const age = now / 1000 - Number(issuedAt)
  if (age < TOKEN_MIN_SECONDS) return 'too-fast'
  if (age > TOKEN_MAX_SECONDS) return 'expired'
  return 'ok'
}

// ---- Duplicates and capacity -------------------------------------------------------------------------------

const DUPLICATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
export const PENDING_CAP = 1000

const normalizeText = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()

/** sha256(type|kind|target|normalized text|payload), with payload keys in a fixed order; no IP is involved. */
export function submissionFingerprint(input: Pick<SubmissionInput, 'type' | 'targetKind' | 'targetId' | 'text' | 'payload'>, targetId: string | null) {
  const payload = Object.entries((input.payload ?? {}) as ContributionPayload).sort(([a], [b]) => a.localeCompare(b))
  return createHash('sha256')
    .update([input.type, input.targetKind, targetId ?? '', normalizeText(input.text), JSON.stringify(payload)].join('|'))
    .digest('hex')
}

/** True when the same correction or proposal was already stored in the last 7 days. */
export async function isRecentDuplicate(fingerprint: string) {
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString()
  const { data, error } = await useDatabaseClient().from('heritage_submissions').select('id')
    .eq('fingerprint', fingerprint).gte('created_at', since).limit(1)
  if (error) databaseError(error)
  return (data?.length ?? 0) > 0
}

/** Refuses new submissions while a large backlog is pending, to protect the free-tier database. */
export async function assertPendingCapacity() {
  const { count, error } = await useDatabaseClient().from('heritage_submissions')
    .select('id', { count: 'exact' }).eq('status', 'pending').limit(1)
  if (error) databaseError(error)
  if ((count ?? 0) > PENDING_CAP) throw createError({ statusCode: 503, statusMessage: 'Too many pending submissions' })
}

/** The cap on links in the note and the payload together (word fields refuse any, see the payload validator). */
export function assertLinkCap(input: Pick<SubmissionInput, 'text' | 'payload'>) {
  if (totalLinks(input.text, input.payload) > CONTRIBUTION_LINK_LIMIT) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid submission', data: { issues: [{ field: 'text', code: 'links' }] } })
  }
}
