import { describe, expect, it } from 'vitest'
import { SUBMISSION_LIMITS, validateSubmission } from '../shared/utils/submission'

const valid = { text: 'kaj', consentPublish: true, locale: 'hr' }

function issuesOf(input: unknown) {
  const result = validateSubmission(input)
  return result.ok ? [] : result.issues
}

describe('validateSubmission', () => {
  it('accepts a minimal submission and trims and empties optional fields', () => {
    const result = validateSubmission({ ...valid, text: '  kaj  ', type: '', place: '  ', name: 'Ana ', contact: undefined })
    expect(result).toEqual({
      ok: true,
      value: { text: 'kaj', type: null, placeId: null, name: 'Ana', contact: null, consentPublish: true, locale: 'hr' }
    })
  })

  it('accepts every field filled in', () => {
    const result = validateSubmission({ ...valid, type: 'expression', placeId: 'geonames:3194024', name: 'Ana', contact: 'ana@example.com', locale: 'en' })
    expect(result.ok).toBe(true)
  })

  it('requires consent to publish, as the boolean true', () => {
    for (const consentPublish of [undefined, false, 'true', 1]) {
      expect(issuesOf({ ...valid, consentPublish })).toEqual([{ field: 'consentPublish', code: 'required' }])
    }
  })

  it('requires the text', () => {
    expect(issuesOf({ ...valid, text: '   ' })).toEqual([{ field: 'text', code: 'required' }])
    expect(issuesOf({ ...valid, text: 42 })).toEqual([{ field: 'text', code: 'required' }])
    expect(issuesOf({ ...valid, text: 'a' })).toEqual([{ field: 'text', code: 'tooShort' }])
  })

  it('enforces length limits', () => {
    expect(issuesOf({ ...valid, text: 'a'.repeat(SUBMISSION_LIMITS.text.max) })).toEqual([])
    expect(issuesOf({
      ...valid,
      text: 'a'.repeat(SUBMISSION_LIMITS.text.max + 1),
      place: 'a'.repeat(SUBMISSION_LIMITS.place.max + 1),
      name: 'a'.repeat(SUBMISSION_LIMITS.name.max + 1),
      contact: 'a'.repeat(SUBMISSION_LIMITS.contact.max + 1)
    })).toEqual([
      { field: 'text', code: 'tooLong' },
      { field: 'place', code: 'refreshPlace' },
      { field: 'name', code: 'tooLong' },
      { field: 'contact', code: 'tooLong' }
    ])
  })

  it('rejects unknown types, locales and non-text values', () => {
    expect(issuesOf({ ...valid, type: 'poem', locale: 'de', name: ['Ana'] })).toEqual([
      { field: 'type', code: 'invalid' },
      { field: 'name', code: 'invalid' },
      { field: 'locale', code: 'invalid' }
    ])
  })

  it('rejects a body that is not an object', () => {
    expect(validateSubmission(null).ok).toBe(false)
    expect(validateSubmission('text').ok).toBe(false)
  })
})
