import { describe, expect, it } from 'vitest'
import { CARD_KEY } from '../shared/utils/learn/types'
import { buildCardPool } from '../server/utils/cardPool'
import { buildPublicContent, ATLAS_REGION_SLUG } from '../server/utils/publicContent'
import type { AreaRow, ItemRow, PublicContentRows } from '../server/utils/publicContent'
import type { WordEntry } from '../app/types/heritage'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ID = {
  region: id(1), town: id(2), kalnik: id(3),
  krizevci: id(10), apatovec: id(11), kalnikSettlement: id(12),
  church: id(20), chapel: id(21),
  ana: id(40), kapela: id(41), duplicateA: id(42), duplicateB: id(43), noSettlement: id(44)
}
const T = '2026-11-01T10:00:00+00:00'

function area(row: Partial<AreaRow> & Pick<AreaRow, 'id' | 'kind' | 'name'>): AreaRow {
  return { parent_id: null, slug: null, official_code: null, latitude: null, longitude: null, status: 'published', updated_at: T, ...row }
}

function item(row: Partial<ItemRow> & Pick<ItemRow, 'id' | 'name' | 'slug' | 'municipality_id'>): ItemRow {
  return {
    category_id: ID.church, settlement_id: null, locality: null, verification: 'unverified', heritage_status: null, registry_number: 'REG-SECRET',
    period: null, description: 'Long description must not leak', research_notes: 'Secret notes', latitude: null, longitude: null, noindex: false, credits: [], status: 'published',
    updated_at: T, ...row
  }
}

function rows(): PublicContentRows {
  return {
    areas: [
      area({ id: ID.region, kind: 'region', name: 'Potkalničko prigorje', slug: ATLAS_REGION_SLUG }),
      area({ id: ID.kalnik, kind: 'municipality', name: 'Kalnik', slug: 'opcina-kalnik' }),
      area({ id: ID.town, kind: 'town', name: 'Križevci', slug: 'grad-krizevci' }),
      area({ id: ID.krizevci, kind: 'settlement', name: 'Križevci', slug: 'krizevci', parent_id: ID.town, latitude: 46.02, longitude: 16.54 }),
      area({ id: ID.apatovec, kind: 'settlement', name: 'Apatovec', slug: 'apatovec', parent_id: ID.town, latitude: 46.03, longitude: 16.55 }),
      area({ id: ID.kalnikSettlement, kind: 'settlement', name: 'Kalnik', slug: 'kalnik', parent_id: ID.kalnik, latitude: 46.04, longitude: 16.56 })
    ],
    areaRegions: [ID.town, ID.kalnik].map(area_id => ({ area_id, region_id: ID.region })),
    categories: [
      { id: ID.church, key: 'church', label_hr: 'Crkva', sort: 1, status: 'published' },
      { id: ID.chapel, key: 'chapel', label_hr: 'Kapela', sort: 2, status: 'published' }
    ],
    sources: [],
    items: [
      item({ id: ID.ana, name: 'Crkva sv. Ane', slug: 'crkva-sv-ane', municipality_id: ID.town, settlement_id: ID.krizevci, verification: 'verified' }),
      item({ id: ID.kapela, name: 'Kapela sv. Marka', slug: 'kapela', category_id: ID.chapel, municipality_id: ID.town, settlement_id: ID.apatovec, noindex: true }),
      item({ id: ID.duplicateA, name: 'Križ', slug: 'kriz-a', municipality_id: ID.town, settlement_id: ID.krizevci }),
      item({ id: ID.duplicateB, name: 'Križ', slug: 'kriz-b', municipality_id: ID.town, settlement_id: ID.apatovec }),
      item({ id: ID.noSettlement, name: 'Raspelo', slug: 'raspelo', category_id: ID.chapel, municipality_id: ID.kalnik })
    ],
    itemSources: [],
    legacyIds: [],
    slugHistory: []
  }
}

function word(partial: Partial<WordEntry> & Pick<WordEntry, 'id' | 'headword' | 'meaning'>): WordEntry {
  return {
    variants: [{ id: 'v1', form: partial.headword, status: 'community', usages: [] }],
    status: 'community',
    sources: [{ id: 's1', kind: 'editor' }],
    ...partial
  }
}

describe('buildCardPool', () => {
  const content = buildPublicContent(rows(), { loadedAt: 0 })

  it('marks seat settlements and attaches municipalityId on places', () => {
    const pool = buildCardPool(content, [])
    const krizevci = pool.cards.find(c => c.kind === 'place' && c.slug === 'krizevci')
    const apatovec = pool.cards.find(c => c.kind === 'place' && c.slug === 'apatovec')
    expect(krizevci).toMatchObject({ municipalityId: ID.town, seat: true })
    expect(apatovec).toMatchObject({ municipalityId: ID.town, seat: false })
  })

  it('excludes noindex items, duplicate folded names and items without a settlement path', () => {
    const pool = buildCardPool(content, [])
    const itemCards = pool.cards.filter(c => c.kind === 'item')
    expect(itemCards.map(c => c.name)).toEqual(['Crkva sv. Ane'])
    expect(itemCards.some(c => c.name === 'Kapela sv. Marka')).toBe(false)
    expect(itemCards.some(c => c.name === 'Križ')).toBe(false)
    expect(itemCards.some(c => c.name === 'Raspelo')).toBe(false)
  })

  it('never copies research notes, description or registry numbers into item cards', () => {
    const pool = buildCardPool(content, [])
    const json = JSON.stringify(pool.cards.filter(c => c.kind === 'item'))
    expect(json).not.toContain('Secret notes')
    expect(json).not.toContain('Long description')
    expect(json).not.toContain('REG-SECRET')
    expect(json).not.toContain('researchNotes')
    expect(json).not.toContain('registryNumber')
  })

  it('drops placeholder words and validates card keys', () => {
    const words = [
      word({ id: 'w1', headword: 'krumper', meaning: { hr: 'krumpir' }, status: 'verified', category: 'food' }),
      word({ id: 'w2', headword: 'uzorak', meaning: { hr: 'primjer' }, status: 'placeholder' })
    ]
    const pool = buildCardPool(content, words)
    expect(pool.cards.some(c => c.kind === 'word' && c.id === 'w1')).toBe(true)
    expect(pool.cards.some(c => c.kind === 'word' && c.id === 'w2')).toBe(false)
    for (const card of pool.cards) expect(card.key).toMatch(CARD_KEY)
  })

  it('computes topic counts and hides rijeci children with fewer than two cards', () => {
    const words = [
      word({ id: 'w1', headword: 'a', meaning: { hr: 'a' }, category: 'food' }),
      word({ id: 'w2', headword: 'b', meaning: { hr: 'b' }, category: 'house' })
    ]
    const pool = buildCardPool(content, words)
    const foodSub = pool.topics.find(t => t.id === 'rijeci-hrana')
    const houseSub = pool.topics.find(t => t.id === 'rijeci-kuca')
    expect(foodSub).toBeUndefined()
    expect(houseSub).toBeUndefined()
    expect(pool.topics.find(t => t.id === 'rijeci')?.count).toBe(2)
    const sumWords = pool.cards.filter(c => c.kind === 'word').length
    expect(pool.topics.find(t => t.id === 'rijeci')?.count).toBe(sumWords)
  })

  it('returns an empty pool when the region snapshot is missing', () => {
    const empty = buildPublicContent({
      areas: [], areaRegions: [], categories: [], sources: [], items: [], itemSources: [], legacyIds: [], slugHistory: []
    }, { loadedAt: 0 })
    const pool = buildCardPool(empty, [])
    expect(pool.cards).toEqual([])
    expect(pool.municipalities).toEqual([])
  })
})
