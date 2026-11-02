// Rules for heritage submissions, shared by the form and the API so both check the same limits.

import { isCorrectionTargetRefFormat } from './correctionReport'

export const SUBMISSION_TYPES = ['word', 'expression', 'memory', 'other', 'correction'] as const
export const SUBMISSION_STATUSES = ['pending', 'approved', 'rejected'] as const
export const SUBMISSION_LOCALES = ['hr', 'en'] as const
// What a contribution from the daily word says about its word: a local form, or "it is said here too".
export const SUBMISSION_INTENTS = ['variant', 'usage'] as const
// Same shape the word API accepts for ids (server/utils/words.ts), so a linked id can never be arbitrary text.
export const WORD_ID_PATTERN = /^[\w~-]{1,200}$/

// Bump when the privacy notice changes, so each stored consent says which text it was given for.
export const PRIVACY_NOTICE_VERSION = '2026-11-02'

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
  targetRef: string | null
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
}

export type SubmissionField = 'text' | 'type' | 'targetRef' | 'wordId' | 'intent' | 'place' | 'name' | 'contact' | 'consentPublish' | 'locale'
export type SubmissionIssueCode = 'required' | 'tooShort' | 'tooLong' | 'invalid' | 'selectPlace' | 'refreshPlace' | 'outOfScope'

export interface SubmissionIssue {
  field: SubmissionField
  code: SubmissionIssueCode
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
    if (isOneOf(SUBMISSION_TYPES, body.type)) type = body.type
    else issues.push({ field: 'type', code: 'invalid' })
  }

  let targetRef: string | null = null
  if (body.targetRef !== undefined && body.targetRef !== null && body.targetRef !== '') {
    if (typeof body.targetRef !== 'string' || !isCorrectionTargetRefFormat(body.targetRef.trim())) {
      issues.push({ field: 'targetRef', code: 'invalid' })
    } else {
      targetRef = body.targetRef.trim()
    }
  }

  if (type === 'correction' && !targetRef && !issues.some(issue => issue.field === 'targetRef')) {
    issues.push({ field: 'targetRef', code: 'required' })
  }
  if (targetRef && type !== 'correction' && !issues.some(issue => issue.field === 'type')) {
    issues.push({ field: 'type', code: 'invalid' })
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
  if (wordId && type === 'correction' && !issues.some(issue => issue.field === 'type')) issues.push({ field: 'type', code: 'invalid' })

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

  return { ok: true, value: { text, type, targetRef, placeId, wordId, intent, name, contact, consentPublish: true, locale } }
}
