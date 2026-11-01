import { describe, expect, it } from 'vitest'
import { SUBMISSION_LIMITS, validateSubmission } from '../shared/utils/submission'
import { VARIANT_REPORT_LIMITS, buildVariantReportText } from '../shared/utils/variantReport'

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
      value: { text: 'kaj', type: null, targetRef: null, placeId: null, name: 'Ana', contact: null, consentPublish: true, locale: 'hr' }
    })
  })

  it('requires a place only for variant reports', () => {
    for (const placeId of [undefined, null, '', '   ']) {
      expect(issuesOf({ ...valid, reportKind: 'variant', placeId })).toEqual([{ field: 'place', code: 'required' }])
      expect(issuesOf({ ...valid, placeId })).toEqual([])
    }
    expect(issuesOf({ ...valid, reportKind: 'variant', placeId: 'geonames:3194024' })).toEqual([])
    expect(issuesOf({ ...valid, reportKind: 'variant', placeId: 'forged' })).toContainEqual({ field: 'place', code: 'invalid' })
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

  it('requires targetRef for corrections and rejects unknown refs', () => {
    expect(issuesOf({ ...valid, type: 'correction' })).toEqual([{ field: 'targetRef', code: 'required' }])
    expect(issuesOf({ ...valid, type: 'correction', targetRef: 'bad id!' })).toEqual([{ field: 'targetRef', code: 'invalid' }])
    expect(issuesOf({ ...valid, type: 'word', targetRef: 'kalnik-crkva-sv-brcka' })).toEqual([{ field: 'type', code: 'invalid' }])
    expect(validateSubmission({
      ...valid,
      type: 'correction',
      targetRef: 'kalnik-crkva-sv-brcka',
      text: 'Zapis: test\n\nPredloženi ispravak:\nLokacija je drugačija.'
    }).ok).toBe(true)
  })

  it('rejects a body that is not an object', () => {
    expect(validateSubmission(null).ok).toBe(false)
    expect(validateSubmission('text').ok).toBe(false)
  })
})

describe('variant report text', () => {
  const intro = 'Umjesto „kruh“ kod nas se kaže: '

  it('starts with the sentence naming the word and the local form', () => {
    expect(buildVariantReportText({ headword: 'kruh', variant: ' kruv ' }, intro, 'Primjer:')).toBe(`${intro}kruv`)
  })

  it('adds the example on its own line only when there is one', () => {
    expect(buildVariantReportText({ headword: 'kruh', variant: 'kruv', example: ' Daj kruv. ' }, intro, 'Primjer:')).toBe(`${intro}kruv\nPrimjer: Daj kruv.`)
    expect(buildVariantReportText({ headword: 'kruh', variant: 'kruv', example: '  ' }, intro, 'Primjer:')).toBe(`${intro}kruv`)
  })

  it('stays within the submission text limit at the longest inputs', () => {
    const text = buildVariantReportText({ headword: 'a'.repeat(200), variant: 'b'.repeat(VARIANT_REPORT_LIMITS.variant.max), example: 'c'.repeat(VARIANT_REPORT_LIMITS.example.max) }, `Umjesto „${'a'.repeat(200)}“ kod nas se kaže: `, 'Primjer:')
    expect(text.length).toBeLessThanOrEqual(SUBMISSION_LIMITS.text.max)
  })
})
