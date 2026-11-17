import { describe, expect, it } from 'vitest'
import {
  GAME_CATALOGUE,
  GAME_REDIRECT_SLUGS,
  gamePathUsesRedirectSlug,
  gameVisibleInPool,
  visibleGames
} from '../shared/utils/games/catalogue'
import type { CardPool } from '../shared/utils/learn/types'

const emptyPool = (): CardPool => ({
  version: 1,
  generatedAt: '',
  cards: [],
  municipalities: [],
  settlements: [],
  topics: []
})

describe('game catalogue', () => {
  it('keeps unique game ids', () => {
    const ids = GAME_CATALOGUE.map(g => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('does not reuse redirect slugs in live game paths', () => {
    for (const game of GAME_CATALOGUE) {
      expect(gamePathUsesRedirectSlug(game.path)).toBe(false)
    }
    expect(GAME_REDIRECT_SLUGS).toHaveLength(7)
  })

  it('hides live games whose needs the pool cannot meet', () => {
    const needsGame = {
      id: 'znacenje' as const,
      title: 'Test',
      blurb: 'Test',
      topic: 'rijeci' as const,
      format: 'odabir' as const,
      minutes: 1,
      path: '/igre/kviz',
      status: 'live' as const,
      challengeable: false,
      needs: { kind: 'word' as const, min: 3 }
    }
    const pool = emptyPool()
    pool.cards = [
      { kind: 'word', key: 'word:a', id: 'a', topics: ['rijeci'], headword: 'a', meaning: 'b', variants: [], status: 'community', transparency: 0.5, difficulty: 1 },
      { kind: 'word', key: 'word:b', id: 'b', topics: ['rijeci'], headword: 'c', meaning: 'd', variants: [], status: 'community', transparency: 0.5, difficulty: 1 }
    ]
    expect(gameVisibleInPool(needsGame, pool)).toBe(false)
    pool.cards.push({ kind: 'word', key: 'word:c', id: 'c', topics: ['rijeci'], headword: 'e', meaning: 'f', variants: [], status: 'community', transparency: 0.5, difficulty: 1 })
    expect(gameVisibleInPool(needsGame, pool)).toBe(true)
  })

  it('never returns soon games from visibleGames', () => {
    expect(visibleGames(null, undefined).every(g => g.status === 'live')).toBe(true)
    expect(visibleGames(null, 'osobe')).toHaveLength(0)
  })
})
