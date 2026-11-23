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
      value: { text: 'kaj', type: null, targetKind: null, targetId: null, payload: null, baseRevision: null, placeId: null, wordId: null, intent: null, name: 'Ana', contact: null, consentPublish: true, locale: 'hr' }
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

  it('refuses photo contributions through the JSON submission contract', () => {
    expect(issuesOf({ ...valid, type: 'photo' })).toEqual([{ field: 'type', code: 'invalid' }])
  })

  it('requires a target for corrections and no longer takes the retired targetRef', () => {
    expect(issuesOf({ ...valid, type: 'correction' })).toEqual([{ field: 'targetKind', code: 'required' }])
    expect(issuesOf({ ...valid, type: 'correction', targetRef: 'kalnik-crkva-sv-brcka' })).toEqual([{ field: 'targetKind', code: 'required' }])
    expect(issuesOf({ ...valid, type: 'correction', targetKind: 'heritage_item', targetId: 'bad id!', payload: { name: 'x' } })).toEqual([{ field: 'targetId', code: 'invalid' }])
    // A stray targetRef on an ordinary submission is ignored, not stored.
    expect(validateSubmission({ ...valid, type: 'word', targetRef: 'kalnik-crkva-sv-brcka' })).toMatchObject({ ok: true })
    expect(validateSubmission({ ...valid, type: 'word', targetRef: 'kalnik-crkva-sv-brcka' })).not.toHaveProperty('value.targetRef')
  })

  it('rejects a body that is not an object', () => {
    expect(validateSubmission(null).ok).toBe(false)
    expect(validateSubmission('text').ok).toBe(false)
  })
})

describe('validateSubmission word link (contributions from the daily word)', () => {
  const place = 'geonames:3194024'
  const word = 'b0c1d2e3-0000-4000-8000-000000000001'

  it('accepts a variant with or without a place, and a usage with a place', () => {
    expect(validateSubmission({ ...valid, wordId: word, intent: 'variant' })).toMatchObject({ ok: true, value: { wordId: word, intent: 'variant', placeId: null } })
    expect(validateSubmission({ ...valid, wordId: word, intent: 'variant', placeId: place })).toMatchObject({ ok: true, value: { wordId: word, intent: 'variant', placeId: place } })
    expect(validateSubmission({ ...valid, wordId: word, intent: 'usage', placeId: place })).toMatchObject({ ok: true, value: { wordId: word, intent: 'usage', placeId: place } })
  })

  it('keeps ordinary submissions unlinked', () => {
    for (const empty of [undefined, null, '']) {
      expect(validateSubmission({ ...valid, wordId: empty, intent: empty })).toMatchObject({ ok: true, value: { wordId: null, intent: null } })
    }
  })

  it('requires the place for a usage, with the selectPlace code', () => {
    for (const placeId of [undefined, null, '', '   ']) {
      expect(issuesOf({ ...valid, wordId: word, intent: 'usage', placeId })).toEqual([{ field: 'place', code: 'selectPlace' }])
    }
    expect(issuesOf({ ...valid, wordId: word, intent: 'usage', placeId: 'forged' })).toEqual([{ field: 'place', code: 'invalid' }])
  })

  it('requires a word whenever an intent is set', () => {
    for (const intent of ['variant', 'usage']) {
      expect(issuesOf({ ...valid, intent, placeId: place })).toEqual([{ field: 'wordId', code: 'required' }])
    }
  })

  it('rejects unknown intents and malformed or non-text word ids', () => {
    expect(issuesOf({ ...valid, wordId: word, intent: 'confirm' })).toEqual([{ field: 'intent', code: 'invalid' }])
    expect(issuesOf({ ...valid, wordId: word, intent: ['usage'] })).toEqual([{ field: 'intent', code: 'invalid' }])
    for (const wordId of ['has space', 'a/b', 'x'.repeat(201), 42, ['a'], { id: 'a' }]) {
      expect(issuesOf({ ...valid, wordId, intent: 'variant' })).toEqual([{ field: 'wordId', code: 'invalid' }])
    }
    expect(issuesOf({ ...valid, wordId: 'hiza', intent: 'variant' })).toEqual([])
    expect(issuesOf({ ...valid, wordId: 'x'.repeat(200), intent: 'variant' })).toEqual([])
  })

  it('does not let a correction point at a word', () => {
    expect(issuesOf({ ...valid, type: 'correction', targetKind: 'heritage_item', targetId: 'kalnik-crkva-sv-brcka', payload: { name: 'x' }, wordId: word, intent: 'variant' })).toEqual([{ field: 'type', code: 'invalid' }])
  })

  it('reports every problem of a bad linked submission together', () => {
    expect(issuesOf({ ...valid, wordId: 'bad id', intent: 'usage' })).toEqual([
      { field: 'wordId', code: 'invalid' },
      { field: 'place', code: 'selectPlace' }
    ])
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
