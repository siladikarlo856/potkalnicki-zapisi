import { describe, expect, it } from 'vitest'
import { DAILY_VILLAGE_SHARE, dailyCacheControl, villageAreaId } from '../server/utils/dailyWord'
import type { Area, WordEntry } from '../app/types/heritage'

// The resolver's pure parts. Resolution and persistence run on Postgres in
// dailyWordResolver.serial.integration.test.ts.
const areas: Area[] = [
  { id: 'county', name: 'Županija', kind: 'county', parentId: null },
  { id: 'vil-a', name: 'Selo A', kind: 'settlement', parentId: 'county' },
  { id: 'vil-b', name: 'Selo B', kind: 'municipality', parentId: 'county' }
]

function entry(usages: string[]): WordEntry {
  return {
    id: 'x', headword: 'riječ', meaning: { hr: 'značenje' }, partOfSpeech: 'imenica', status: 'community', sources: [{ id: 'editor', kind: 'editor' }],
    variants: [{ id: 'v1', form: 'riječ', status: 'community', usages: usages.map(areaId => ({ areaId, confidence: 'reported' as const })) }]
  }
}

describe('village words', () => {
  it('classifies a word as village-specific only when all usages map to one place', () => {
    expect(villageAreaId(entry(['vil-a']), areas)).toBe('vil-a')
    expect(villageAreaId(entry(['vil-a', 'vil-b']), areas)).toBeNull()
    expect(villageAreaId(entry(['county']), areas)).toBeNull()
    expect(villageAreaId(entry(['vil-a', 'county']), areas)).toBeNull()
    expect(villageAreaId(entry([]), areas)).toBeNull()
    expect(DAILY_VILLAGE_SHARE).toBeCloseTo(1 / 7)
  })
})

describe('cache headers', () => {
  it('caches for at most 30 seconds and never past the end of the day', () => {
    const nextAt = '2026-11-05T23:00:00.000Z'
    expect(dailyCacheControl(nextAt, new Date('2026-11-05T12:00:00Z'))).toBe('public, max-age=30, s-maxage=30, must-revalidate')
    expect(dailyCacheControl(nextAt, new Date('2026-11-05T22:59:48Z'))).toBe('public, max-age=12, s-maxage=12, must-revalidate')
    expect(dailyCacheControl(nextAt, new Date('2026-11-05T22:59:59.500Z'))).toBe('public, max-age=1, s-maxage=1, must-revalidate')
    expect(dailyCacheControl(nextAt, new Date('2026-11-05T23:00:00Z'))).toBe('public, max-age=0, s-maxage=0, must-revalidate')
  })
})
