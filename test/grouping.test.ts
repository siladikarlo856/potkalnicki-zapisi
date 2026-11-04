import { describe, expect, it } from 'vitest'
import type { CardPool, PoolWord } from '../shared/utils/learn/types'
import {
  buildGroupingPuzzle,
  dailyGroupingSeed,
  evaluateGroupingGuess,
  groupingAvailable,
  isOneAway
} from '../shared/utils/games/grouping'
import { fixtureCardPool } from './fixtures/gamePool'

function word(id: string, headword: string, category: PoolWord['category']): PoolWord {
  return {
    kind: 'word',
    key: `word:${id}`,
    id,
    headword,
    meaning: headword,
    variants: [],
    status: 'verified',
    category,
    topics: ['rijeci'],
    transparency: 0.5,
    difficulty: 2
  }
}

function poolWithWordCategories(): CardPool {
  const base = fixtureCardPool()
  const extra: PoolWord[] = []
  const categories: PoolWord['category'][] = ['food', 'clothing', 'work', 'function', 'people', 'house', 'yard', 'time']
  categories.forEach((category) => {
    for (let i = 0; i < 4; i++) {
      extra.push(word(`w-${category}-${i}`, `${category}-${i}`, category))
    }
  })
  return { ...base, cards: [...base.cards.filter(c => c.kind !== 'word'), ...extra] }
}

describe('grouping generator', () => {
  it('builds 16 tiles in four disjoint groups', () => {
    const pool = poolWithWordCategories()
    expect(groupingAvailable(pool)).toBe(true)
    const puzzle = buildGroupingPuzzle(pool, 'words', 42)
    expect(puzzle).not.toBeNull()
    expect(puzzle!.tiles).toHaveLength(16)
    expect(puzzle!.groups).toHaveLength(4)
    const tileGroups = new Set(puzzle!.tiles.map(t => t.groupId))
    expect(tileGroups.size).toBe(4)
    for (const group of puzzle!.groups) {
      expect(group.tileIds).toHaveLength(4)
      const labels = group.tileIds.map(id => puzzle!.tiles.find(t => t.id === id)?.label)
      expect(new Set(labels).size).toBe(4)
    }
  })

  it('uses a stable daily seed', () => {
    const a = dailyGroupingSeed('2026-11-04', 'words')
    const b = dailyGroupingSeed('2026-11-04', 'words')
    const c = dailyGroupingSeed('2026-11-05', 'words')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })

  it('detects a correct guess and one-away', () => {
    const pool = poolWithWordCategories()
    const puzzle = buildGroupingPuzzle(pool, 'words', 99)!
    const group = puzzle.groups[0]!
    expect(evaluateGroupingGuess(puzzle, group.tileIds)).toBe('correct')
    const almost = [...group.tileIds.slice(0, 3), puzzle.groups[1]!.tileIds[0]!]
    expect(isOneAway(puzzle, almost)).toBe(true)
    expect(evaluateGroupingGuess(puzzle, almost)).toBe('one-away')
  })
})
