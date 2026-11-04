import { describe, expect, it } from 'vitest'
import { generateHeritageMatchBoards, HERITAGE_MATCH_PAIRS } from '../shared/utils/games/heritageMatch'
import { mulberry32 } from '../shared/utils/games/rng'
import { fixtureCardPool } from './fixtures/gamePool'

describe('generateHeritageMatchBoards', () => {
  it('builds shuffled boards with four pairs each', () => {
    const pool = fixtureCardPool()
    const template = pool.cards.find(c => c.kind === 'item')!
    const settlements = pool.settlements
    if (settlements.length < 4) {
      pool.settlements.push({
        id: 'settlement-extra',
        name: 'Miholec',
        slug: 'miholec',
        municipalityId: template.municipalityId,
        lat: 46.05,
        lng: 16.57,
        itemCount: 0,
        seat: false
      })
    }
    const allSettlements = pool.settlements
    for (let i = 0; pool.cards.filter(c => c.kind === 'item').length < 4; i++) {
      pool.cards.push({
        ...template,
        key: `item:extra-${i}`,
        id: `extra-${i}`,
        name: `Kapela test ${i}`,
        settlementId: allSettlements[i % allSettlements.length]!.id
      })
    }
    const boards = generateHeritageMatchBoards(pool, ['bastina'], mulberry32(42), 1)
    expect(boards.length).toBeGreaterThanOrEqual(1)
    for (const board of boards) {
      expect(board.pairs).toHaveLength(HERITAGE_MATCH_PAIRS)
      expect(board.left).toHaveLength(HERITAGE_MATCH_PAIRS)
      expect(board.right).toHaveLength(HERITAGE_MATCH_PAIRS)
      expect(new Set(board.left.map(t => t.label)).size).toBe(HERITAGE_MATCH_PAIRS)
    }
  })
})
