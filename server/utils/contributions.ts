import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import type { ContributionKind, ContributionPayload } from '../../shared/utils/contribution'
import { CONTRIBUTION_LINK_LIMIT, totalLinks } from '../../shared/utils/contribution'
import type { SubmissionInput } from '../../shared/utils/submission'
import { findPublished } from './content/records'

// The public side of corrections and proposals: resolving what a correction is about, and the spam
// hardening that sits on top of the existing honeypot, per-IP limit and 16 KB cap (README, "Corrections
// and proposals"): per-target throttle, duplicate fingerprint, link cap, minimum fill time, pending cap.

export interface ContributionTarget {
  id: string
  revision: number
}

/**
 * The Published row a Correction is about, by UUID or (for kinds that had one) an old id. Returns null for
 * anything unknown or not Published and, for areas, not a settlement: only Published content takes a Correction.
 */
export async function resolveContributionTarget(kind: ContributionKind, value: string): Promise<ContributionTarget | null> {
  const target = await findPublished(kind, kind === 'area' ? { id: value, kind: 'settlement' } : value)
  return target ? { id: target.id, revision: Number(target.revision) } : null
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
