// Rules for heritage submissions, shared by the form and the API so both check the same limits.

import { isCorrectionTargetRefFormat } from './correctionReport'
import type { ContributionKind, ContributionPayload } from './contribution'
import { CONTRIBUTION_ALLOWED, isContributionKind, validateContributionPayload } from './contribution'

// 'proposal' is a suggestion for a new row (a heritage item, settlement, source or word); 'correction'
// is a change to an existing one, as a `targetKind` + `targetId` with a `payload` of the proposed fields.
export const SUBMISSION_TYPES = ['word', 'expression', 'memory', 'other', 'correction', 'proposal', 'photo'] as const
export const SUBMISSION_STATUSES = ['pending', 'approved', 'rejected'] as const
export const SUBMISSION_LOCALES = ['hr', 'en'] as const
// What a contribution from the daily word says about its word: a local form, or "it is said here too".
export const SUBMISSION_INTENTS = ['variant', 'usage'] as const
// Same shape the word API accepts for ids (server/utils/words.ts), so a linked id can never be arbitrary text.
export const WORD_ID_PATTERN = /^[\w~-]{1,200}$/

// Bump when the privacy notice changes, so each stored consent says which text it was given for.
export const PRIVACY_NOTICE_VERSION = '2026-11-22'

export const SUBMISSION_LIMITS = {
  text: { min: 2, max: 2000 },
  place: { max: 120 },
  name: { max: 100 },
  contact: { max: 200 }
} as const

export type SubmissionType = typeof SUBMISSION_TYPES[number]
export type SubmissionStatus = typeof SUBMISSION_STATUSES[number]
export type SubmissionLocale = typeof SUBMISSION_LOCALES[number]
export type SubmissionIntent = typeof SUBMISSION_INTENTS[number]

export interface SubmissionInput {
  text: string
  type: SubmissionType | null
  /** Structured corrections and proposals: what they are about and the proposed fields. */
  targetKind: ContributionKind | null
  /** A UUID, or an old id the server resolves (heritage items, settlements, sources). Null for proposals. */
  targetId: string | null
  payload: ContributionPayload | null
  /** Revision of the target the sender saw; the server fills in the current one when it is missing. */
  baseRevision: number | null
  placeId: string | null
  wordId: string | null
  intent: SubmissionIntent | null
  name: string | null
  contact: string | null
  consentPublish: true
  locale: SubmissionLocale
}

export interface Submission extends Omit<SubmissionInput, 'consentPublish'> {
  id: number
  /** Headword of the linked word, read for review; null when there is no link. */
  wordHeadword: string | null
  place: string | null
  placeCatalogVersion: string | null
  placeContext: string | null
  consentPublish: boolean
  consentVersion: string
  status: SubmissionStatus
  createdAt: string
  reviewedAt: string | null
  /** Set once an admin applied the correction or published the draft made from the proposal. */
  appliedAt: string | null
  appliedEntityId: string | null
}

export type SubmissionField = 'text' | 'type' | 'targetKind' | 'targetId' | 'payload' | 'baseRevision' | 'wordId' | 'intent' | 'place' | 'name' | 'contact' | 'consentPublish' | 'locale'
export type SubmissionIssueCode = 'required' | 'tooShort' | 'tooLong' | 'invalid' | 'selectPlace' | 'refreshPlace' | 'outOfScope' | 'unknown' | 'links'

export interface SubmissionIssue {
  field: SubmissionField
  code: SubmissionIssueCode
  /** For a payload issue: the payload field it is about ('' for the payload as a whole). */
  path?: string
}

export type SubmissionValidation
  = | { ok: true, value: SubmissionInput }
    | { ok: false, issues: SubmissionIssue[] }

function optionalText(value: unknown, field: SubmissionField, max: number, issues: SubmissionIssue[]) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') {
    issues.push({ field, code: 'invalid' })
    return null
  }
  const trimmed = value.trim()
  if (trimmed.length > max) issues.push({ field, code: 'tooLong' })
  return trimmed || null
}

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value)
}

export function validateSubmission(input: unknown): SubmissionValidation {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const issues: SubmissionIssue[] = []

  let text = ''
  if (typeof body.text !== 'string' || !body.text.trim()) {
    issues.push({ field: 'text', code: 'required' })
  } else {
    text = body.text.trim()
    if (text.length < SUBMISSION_LIMITS.text.min) issues.push({ field: 'text', code: 'tooShort' })
    else if (text.length > SUBMISSION_LIMITS.text.max) issues.push({ field: 'text', code: 'tooLong' })
  }

  let type: SubmissionType | null = null
  if (body.type !== undefined && body.type !== null && body.type !== '') {
    if (isOneOf(SUBMISSION_TYPES, body.type) && body.type !== 'photo') type = body.type
    else issues.push({ field: 'type', code: 'invalid' })
  }

  const structured = body.targetKind !== undefined && body.targetKind !== null && body.targetKind !== ''
  if (type === 'correction' && !structured) issues.push({ field: 'targetKind', code: 'required' })

  let targetKind: ContributionKind | null = null
  let targetId: string | null = null
  let payload: ContributionPayload | null = null
  let baseRevision: number | null = null
  if (structured || type === 'proposal') {
    if (type !== 'correction' && type !== 'proposal') {
      if (!issues.some(issue => issue.field === 'type')) issues.push({ field: 'type', code: 'invalid' })
    } else if (!isContributionKind(body.targetKind)) {
      issues.push({ field: 'targetKind', code: structured ? 'invalid' : 'required' })
    } else if (!CONTRIBUTION_ALLOWED[body.targetKind].includes(type)) {
      issues.push({ field: 'targetKind', code: 'outOfScope' })
    } else {
      targetKind = body.targetKind
      if (type === 'correction') {
        const rawId = typeof body.targetId === 'string' ? body.targetId.trim().toLowerCase() : ''
        if (!rawId) issues.push({ field: 'targetId', code: 'required' })
        else if (!isCorrectionTargetRefFormat(rawId)) issues.push({ field: 'targetId', code: 'invalid' })
        else targetId = rawId
      } else if (body.targetId !== undefined && body.targetId !== null && body.targetId !== '') {
        issues.push({ field: 'targetId', code: 'invalid' })
      }
      const checked = validateContributionPayload(targetKind, type, body.payload)
      for (const issue of checked.issues) issues.push({ field: 'payload', code: issue.code, path: issue.path })
      payload = checked.value
      if (body.baseRevision !== undefined && body.baseRevision !== null) {
        if (type === 'correction' && typeof body.baseRevision === 'number' && Number.isSafeInteger(body.baseRevision) && body.baseRevision >= 1) baseRevision = body.baseRevision
        else issues.push({ field: 'baseRevision', code: 'invalid' })
      }
    }
  } else if (body.payload !== undefined && body.payload !== null) {
    issues.push({ field: 'payload', code: 'invalid' })
  }

  let wordId: string | null = null
  if (body.wordId !== undefined && body.wordId !== null && body.wordId !== '') {
    if (typeof body.wordId !== 'string' || !WORD_ID_PATTERN.test(body.wordId)) issues.push({ field: 'wordId', code: 'invalid' })
    else wordId = body.wordId
  }
  let intent: SubmissionIntent | null = null
  if (body.intent !== undefined && body.intent !== null && body.intent !== '') {
    if (isOneOf(SUBMISSION_INTENTS, body.intent)) intent = body.intent
    else issues.push({ field: 'intent', code: 'invalid' })
  }
  // A link only means something with a word; corrections have their own target and never concern a word.
  if (intent && !wordId && !issues.some(issue => issue.field === 'wordId')) issues.push({ field: 'wordId', code: 'required' })
  if (wordId && (type === 'correction' || type === 'proposal') && !issues.some(issue => issue.field === 'type')) issues.push({ field: 'type', code: 'invalid' })

  // Cached old clients must refresh/reselect instead of submitting arbitrary location text.
  if (body.place !== undefined && body.place !== null && body.place !== '') {
    if (typeof body.place !== 'string' || body.place.trim()) issues.push({ field: 'place', code: 'refreshPlace' })
  }
  const placeId = optionalText(body.placeId, 'place', 40, issues)
  // Variant reports need a location; ordinary contributions may still omit it.
  if (body.reportKind === 'variant' && !placeId && !issues.some(issue => issue.field === 'place')) issues.push({ field: 'place', code: 'required' })
  // Confirming that a word is used "here" is only worth anything with the place.
  if (intent === 'usage' && !placeId && !issues.some(issue => issue.field === 'place')) issues.push({ field: 'place', code: 'selectPlace' })
  if (placeId && !/^geonames:[0-9]{1,10}$/.test(placeId)) issues.push({ field: 'place', code: 'invalid' })
  const name = optionalText(body.name, 'name', SUBMISSION_LIMITS.name.max, issues)
  const contact = optionalText(body.contact, 'contact', SUBMISSION_LIMITS.contact.max, issues)

  if (body.consentPublish !== true) issues.push({ field: 'consentPublish', code: 'required' })

  const locale = isOneOf(SUBMISSION_LOCALES, body.locale) ? body.locale : null
  if (!locale) issues.push({ field: 'locale', code: 'invalid' })

  if (issues.length || !locale) return { ok: false, issues }

  return { ok: true, value: { text, type, targetKind, targetId, payload, baseRevision, placeId, wordId, intent, name, contact, consentPublish: true, locale } }
}
