import { describe, expect, it } from 'vitest'
import {
  applyWordCorrection, CONTRIBUTION_ALLOWED, CONTRIBUTION_KINDS, countLinks, validateContributionPayload
} from '../shared/utils/contribution'
import { validateSubmission } from '../shared/utils/submission'

const CATEGORY = '5f2d1c3e-0000-4000-8000-000000000001'
const SETTLEMENT = '5f2d1c3e-0000-4000-8000-000000000002'
const valid = { text: 'Kapela se zove drugačije.', consentPublish: true, locale: 'hr' }

describe('who may submit what', () => {
  it('lets words, heritage items and settlements take both, sources only proposals, and nothing else exist', () => {
    expect(CONTRIBUTION_KINDS).toEqual(['word', 'heritage_item', 'area', 'source', 'person', 'club'])
    expect(CONTRIBUTION_ALLOWED.word).toEqual(['correction', 'proposal'])
    expect(CONTRIBUTION_ALLOWED.heritage_item).toEqual(['correction', 'proposal'])
    expect(CONTRIBUTION_ALLOWED.area).toEqual(['correction', 'proposal'])
    expect(CONTRIBUTION_ALLOWED.source).toEqual(['proposal'])
  })
})

describe('validateContributionPayload', () => {
  it('keeps only whitelisted fields, trimmed, and refuses everything else', () => {
    const result = validateContributionPayload('heritage_item', 'correction', { name: '  Kapela sv. Ane ', description: '', categoryId: CATEGORY.toUpperCase() })
    expect(result.issues).toEqual([])
    expect(result.value).toEqual({ name: 'Kapela sv. Ane', categoryId: CATEGORY })

    for (const field of ['status', 'slug', 'id', 'credits', 'revision', 'municipalityId']) {
      expect(validateContributionPayload('heritage_item', 'correction', { name: 'x', [field]: 'y' }).issues).toContainEqual({ path: field, code: 'unknown' })
    }
    expect(validateContributionPayload('heritage_item', 'correction', { name: 123 }).issues).toContainEqual({ path: 'name', code: 'invalid' })
    expect(validateContributionPayload('heritage_item', 'correction', { name: 'x'.repeat(201) }).issues).toContainEqual({ path: 'name', code: 'tooLong' })
    expect(validateContributionPayload('heritage_item', 'correction', { categoryId: 'nije-uuid' }).issues).toContainEqual({ path: 'categoryId', code: 'invalid' })
    expect(validateContributionPayload('heritage_item', 'correction', 'text').issues).toEqual([{ path: '', code: 'invalid' }])
    expect(validateContributionPayload('heritage_item', 'correction', ['a']).issues).toEqual([{ path: '', code: 'invalid' }])
  })

  it('requires a correction to change something and a proposal to have its required fields', () => {
    expect(validateContributionPayload('heritage_item', 'correction', {}).issues).toEqual([{ path: '', code: 'required' }])
    expect(validateContributionPayload('heritage_item', 'correction', { name: '   ' }).issues).toEqual([{ path: '', code: 'required' }])
    expect(validateContributionPayload('heritage_item', 'proposal', {}).issues).toEqual(expect.arrayContaining([
      { path: 'name', code: 'required' }, { path: 'categoryId', code: 'required' }, { path: 'settlementId', code: 'required' }
    ]))
    expect(validateContributionPayload('heritage_item', 'proposal', { name: 'Nova kapela', categoryId: CATEGORY, settlementId: SETTLEMENT }).issues).toEqual([])
    expect(validateContributionPayload('area', 'proposal', { name: 'Novo selo' }).issues).toEqual([{ path: 'parentId', code: 'required' }])
    expect(validateContributionPayload('source', 'proposal', { title: 'Knjiga', type: 'publication', url: 'https://example.org/k' }).issues).toEqual([])
    expect(validateContributionPayload('source', 'proposal', { title: 'Knjiga', type: 'spam' }).issues).toContainEqual({ path: 'type', code: 'invalid' })
    expect(validateContributionPayload('source', 'proposal', { title: 'Knjiga', url: 'javascript:alert(1)' }).issues).toContainEqual({ path: 'url', code: 'invalid' })
  })

  it('refuses kinds and modes that take no contributions', () => {
    expect(validateContributionPayload('source', 'correction', { title: 'x' }).issues).toEqual([{ path: '', code: 'invalid' }])
  })

  it('keeps a word variant together with its place, takes places only as catalog ids, and allows no links in word fields', () => {
    expect(validateContributionPayload('word', 'correction', { variantForm: 'kej' }).issues).toEqual([{ path: 'variantPlaceId', code: 'required' }])
    expect(validateContributionPayload('word', 'correction', { variantPlaceId: 'geonames:3197230' }).issues).toEqual([{ path: 'variantForm', code: 'required' }])
    expect(validateContributionPayload('word', 'correction', { variantForm: 'kej', variantPlaceId: 'geonames:3197230' }).issues).toEqual([])
    expect(validateContributionPayload('word', 'correction', { variantForm: 'kej', variantPlaceId: 'Križevci' }).issues).toContainEqual({ path: 'variantPlaceId', code: 'invalid' })
    expect(validateContributionPayload('word', 'correction', { example: 'Vidi www.primjer.hr' }).issues).toContainEqual({ path: '', code: 'links' })
  })

  it('caps links across the whole payload', () => {
    const links = { sourceNote: 'https://a.example/1 https://b.example/2 https://c.example/3' }
    expect(validateContributionPayload('heritage_item', 'correction', { name: 'x', ...links }).issues).toContainEqual({ path: '', code: 'links' })
    expect(validateContributionPayload('heritage_item', 'correction', { name: 'x', sourceNote: 'https://a.example/1 i https://b.example/2' }).issues).toEqual([])
    expect(countLinks('bez poveznica, samo http i www')).toBe(0)
    expect(countLinks('https://a.example i www.b.example')).toBe(2)
  })
})

describe('validateSubmission with a target', () => {
  const correction = { ...valid, type: 'correction', targetKind: 'heritage_item', targetId: SETTLEMENT, payload: { name: 'Nova kapela' } }
  const proposal = { ...valid, type: 'proposal', targetKind: 'heritage_item', payload: { name: 'Nova kapela', categoryId: CATEGORY, settlementId: SETTLEMENT } }

  it('accepts a structured correction and a proposal and carries the payload and target', () => {
    const result = validateSubmission({ ...correction, baseRevision: 4 })
    expect(result).toMatchObject({ ok: true, value: { type: 'correction', targetKind: 'heritage_item', targetId: SETTLEMENT, payload: { name: 'Nova kapela' }, baseRevision: 4 } })
    expect(validateSubmission(proposal)).toMatchObject({ ok: true, value: { type: 'proposal', targetKind: 'heritage_item', targetId: null } })
    // An old atlas id still works as the targetId of a correction; the retired targetRef form does not.
    expect(validateSubmission({ ...correction, targetId: 'kalnik-crkva-sv-brcka' })).toMatchObject({ ok: true, value: { targetKind: 'heritage_item', targetId: 'kalnik-crkva-sv-brcka' } })
    expect(validateSubmission({ ...valid, type: 'correction', targetRef: 'kalnik-crkva-sv-brcka' })).toMatchObject({ ok: false, issues: [{ field: 'targetKind', code: 'required' }] })
  })

  it('refuses what the contribution rules do not allow', () => {
    const issues = (body: object) => (validateSubmission(body) as { issues: unknown[] }).issues
    expect(issues({ ...correction, targetKind: 'heritage_category' })).toContainEqual({ field: 'targetKind', code: 'invalid' })
    expect(issues({ ...correction, targetKind: 'source' })).toContainEqual({ field: 'targetKind', code: 'outOfScope' })
    expect(issues({ ...correction, targetId: undefined })).toContainEqual({ field: 'targetId', code: 'required' })
    expect(issues({ ...correction, targetId: 'Nije Dobro!' })).toContainEqual({ field: 'targetId', code: 'invalid' })
    expect(issues({ ...proposal, targetId: SETTLEMENT })).toContainEqual({ field: 'targetId', code: 'invalid' })
    expect(issues({ ...proposal, targetKind: undefined })).toContainEqual({ field: 'targetKind', code: 'required' })
    expect(issues({ ...proposal, payload: { ...proposal.payload, status: 'published' } })).toContainEqual({ field: 'payload', code: 'unknown', path: 'status' })
    expect(issues({ ...proposal, payload: undefined })).toContainEqual({ field: 'payload', code: 'invalid', path: '' })
    expect(issues({ ...valid, type: 'word', targetKind: 'word', payload: { headword: 'x' } })).toContainEqual({ field: 'type', code: 'invalid' })
    expect(issues({ ...valid, type: 'word', payload: { headword: 'x' } })).toContainEqual({ field: 'payload', code: 'invalid' })
    expect(issues({ ...correction, baseRevision: 0 })).toContainEqual({ field: 'baseRevision', code: 'invalid' })
    expect(issues({ ...proposal, baseRevision: 3 })).toContainEqual({ field: 'baseRevision', code: 'invalid' })
    expect(issues({ ...correction, consentPublish: false })).toContainEqual({ field: 'consentPublish', code: 'required' })
  })
})

describe('applyWordCorrection', () => {
  const entry = { id: 'w', headword: 'kaj', meaning: { hr: 'što', en: 'what' }, partOfSpeech: 'zamjenica', examples: [{ text: 'Kaj delaš?' }], variants: [{ id: 'v1', form: 'kaj', status: 'community', usages: [] }] }

  it('changes the meaning, adds an example and a variant with its area, and leaves the original alone', () => {
    const next = applyWordCorrection(entry, { meaningHr: 'što (upitno)', example: 'Kaj je to?', variantForm: 'kej', variantPlaceId: 'geonames:1' }, 'area-1', () => 'new-id')
    expect(next.meaning).toEqual({ hr: 'što (upitno)', en: 'what' })
    expect(next.examples).toEqual([{ text: 'Kaj delaš?' }, { text: 'Kaj je to?' }])
    expect(next.variants).toEqual([entry.variants[0], { id: 'new-id', form: 'kej', status: 'community', usages: [{ areaId: 'area-1', confidence: 'reported' }] }])
    expect(entry.meaning.hr).toBe('što')
    expect(entry.examples).toHaveLength(1)
  })

  it('adds a variant without a usage when its area is not in the database', () => {
    const next = applyWordCorrection(entry, { variantForm: 'kej', variantPlaceId: 'geonames:1' }, null, () => 'n')
    expect(next.variants.at(-1)).toMatchObject({ form: 'kej', usages: [] })
  })
})
