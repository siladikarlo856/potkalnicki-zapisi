import { describe, expect, it } from 'vitest'
import { getAtlas, settlementByCode } from '../shared/utils/atlasData'
import { isAsciiId } from '../shared/utils/atlasSlug'
import report from '../content/atlas/import-report.json'
import sources from '../content/atlas/sources.json'

describe('atlas content import', () => {
  const atlas = getAtlas()
  const sourceIds = new Set(sources.map(s => s.id))

  it('covers five municipalities and 135 settlements', () => {
    expect(atlas.municipalities).toHaveLength(5)
    expect(atlas.settlements).toHaveLength(135)
    expect(atlas.heritage).toHaveLength(107)
  })

  it('uses ASCII ids and resolves sources', () => {
    for (const item of atlas.heritage) {
      expect(isAsciiId(item.id)).toBe(true)
      expect(item.sourceIds.length).toBeGreaterThan(0)
      for (const sid of item.sourceIds) {
        expect(sourceIds.has(sid)).toBe(true)
      }
    }
  })

  it('resolves linked settlements and keeps (settlement, slug) unique', () => {
    const pairs = new Set<string>()
    for (const item of atlas.heritage) {
      if (!item.settlementCode) continue
      expect(settlementByCode(item.settlementCode)).toBeDefined()
      const key = `${item.settlementCode}:${item.slug}`
      expect(pairs.has(key)).toBe(false)
      pairs.add(key)
    }
  })

  it('records uncertain settlement labels without guessing', () => {
    expect(report.unmappedSettlements.length).toBeGreaterThan(0)
    const unmappedIds = new Set(report.unmappedSettlements.map(r => r.itemId))
    for (const item of atlas.heritage) {
      if (unmappedIds.has(item.legacyId)) {
        expect(item.settlementCode).toBeNull()
      }
    }
  })
})
