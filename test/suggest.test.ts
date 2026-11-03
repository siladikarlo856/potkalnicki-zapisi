import { describe, expect, it } from 'vitest'
import { buildSuggestPayload, parseSuggestQuery, suggestQuery, suggestSummary } from '../shared/utils/suggest'
import { validateSubmission } from '../shared/utils/submission'
import { buildPublicContent } from '../server/utils/publicContent'
import { searchContent, settlementPage, suggestOptions } from '../server/utils/publicAtlas'
import { fakeContentRows } from './helpers/fakeContentSeed'

describe('parseSuggestQuery', () => {
  it('reads the old correction link by its legacy id', () => {
    expect(parseSuggestQuery({ vrsta: 'ispravak', zapis: 'krizevci-crkva-sv-ane' })).toEqual({ mode: 'correction', kind: 'heritage_item', id: 'krizevci-crkva-sv-ane' })
  })

  it('reads the new correction and proposal forms', () => {
    const id = '8ca54414-a168-80b7-bc80-619d7c36827a'
    expect(parseSuggestQuery({ vrsta: 'ispravak', sadrzaj: 'heritage_item', id })).toEqual({ mode: 'correction', kind: 'heritage_item', id })
    expect(parseSuggestQuery({ vrsta: 'ispravak', sadrzaj: 'word', id })).toEqual({ mode: 'correction', kind: 'word', id })
    expect(parseSuggestQuery({ vrsta: 'prijedlog', sadrzaj: 'heritage_item', naselje: 'kalnik' })).toEqual({ mode: 'proposal', kind: 'heritage_item', settlement: 'kalnik', municipality: undefined })
  })

  it('opens the search for a bare correction link', () => {
    expect(parseSuggestQuery({ vrsta: 'ispravak' })).toEqual({ mode: 'search' })
  })

  it('refuses what visitors may not submit and leaves the other forms alone', () => {
    expect(parseSuggestQuery({ vrsta: 'ispravak', sadrzaj: 'source', id: 'x' })).toBeNull()
    expect(parseSuggestQuery({ vrsta: 'prijedlog', sadrzaj: 'county' })).toBeNull()
    expect(parseSuggestQuery({ vrsta: 'ispravak', sadrzaj: 'area' })).toBeNull()
    expect(parseSuggestQuery({ vrsta: 'rijec' })).toBeNull()
    expect(parseSuggestQuery({})).toBeNull()
  })

  it('builds the links the cards use', () => {
    expect(suggestQuery('proposal', 'source')).toEqual({ vrsta: 'prijedlog', sadrzaj: 'source' })
    expect(suggestQuery('correction', 'area', { id: 'abc' })).toEqual({ vrsta: 'ispravak', sadrzaj: 'area', id: 'abc' })
  })
})

describe('buildSuggestPayload', () => {
  it('sends a correction only the fields that changed', () => {
    const current = { name: 'Crkva sv. Ane', locality: '', categoryKey: 'church' }
    expect(buildSuggestPayload('heritage_item', 'correction', { name: 'Crkva svete Ane', locality: '', categoryKey: 'church' }, current))
      .toEqual({ name: 'Crkva svete Ane' })
  })

  it('drops keys outside the whitelist and empty values', () => {
    expect(buildSuggestPayload('source', 'proposal', { title: ' Knjiga ', status: 'published', url: '', slug: 'x' })).toEqual({ title: 'Knjiga' })
  })

  it('produces a submission the shared validator accepts', () => {
    const payload = buildSuggestPayload('word', 'correction', { meaningHr: 'novo značenje' }, { meaningHr: 'staro' })
    const result = validateSubmission({
      text: suggestSummary('correction', 'hiza'), type: 'correction', targetKind: 'word', targetId: 'f13d74f1-67db-843e-9d87-84ca34aeda1e',
      payload, consentPublish: true, locale: 'hr'
    })
    expect(result.ok).toBe(true)
  })

  it('is refused by the validator when nothing changed', () => {
    const result = validateSubmission({
      text: 'Ispravak: hiza', type: 'correction', targetKind: 'word', targetId: 'f13d74f1-67db-843e-9d87-84ca34aeda1e',
      payload: buildSuggestPayload('word', 'correction', { meaningHr: 'isto' }, { meaningHr: 'isto' }), consentPublish: true, locale: 'hr'
    })
    expect(result.ok).toBe(false)
  })
})

describe('public suggestion lookups', () => {
  const content = buildPublicContent(fakeContentRows(), {})

  it('lists published categories and places with their ids', () => {
    const options = suggestOptions(content)
    expect(options.categories.length).toBeGreaterThan(0)
    expect(options.categories.every(category => /^[0-9a-f-]{36}$/.test(category.id))).toBe(true)
    expect(options.settlements.length).toBe(content.settlements.length)
    expect(options.municipalities.map(m => m.id)).toContain(options.settlements[0]!.municipalityId)
  })

  it('searches items and settlements by name, ignoring diacritics', () => {
    const settlement = content.settlements[0]!
    const found = searchContent(content, settlement.name.toUpperCase())
    expect(found.settlements.map(row => row.id)).toContain(settlement.id)
    expect(searchContent(content, 'a')).toEqual({ items: [], settlements: [] })
    const item = content.items[0]!
    expect(searchContent(content, item.name).items.map(row => row.id)).toContain(item.id)
  })

  it('carries credits and the last edit date on a settlement page', () => {
    const page = settlementPage(content, content.settlements[0]!)
    expect(page.settlement.credits).toEqual([])
    expect(page.settlement.updatedAt).toBeTruthy()
  })
})
