import { describe, expect, it } from 'vitest'
import type { CardPool, PoolCard } from '../shared/utils/learn/types'
import { buildLearnReviewQuestion, shouldAskReviewQuestion } from '../shared/utils/learn/reviewQuestion'

function word(id: string, headword: string, meaning: string): PoolCard {
  return {
    kind: 'word',
    key: `word:${id}`,
    id,
    topics: ['rijeci'],
    headword,
    meaning,
    variants: [],
    status: 'verified',
    transparency: 0.5,
    difficulty: 2
  }
}

function pool(cards: PoolCard[]): CardPool {
  return {
    version: 1,
    generatedAt: '2026-11-04T00:00:00.000Z',
    cards,
    municipalities: [],
    settlements: [],
    topics: [{ id: 'rijeci', label: 'Riječi', status: 'live', count: cards.length }]
  }
}

describe('learn review questions', () => {
  it('asks review cards in review mode and due cards in new mode', () => {
    const key = 'word:a' as const
    const progress = {
      [key]: { box: 1, due: '2026-11-04', seen: 1, known: 0, missed: 1, lastPlayed: '2026-11-03' }
    }
    expect(shouldAskReviewQuestion('review', key, progress, '2026-11-04', {})).toBe(true)
    expect(shouldAskReviewQuestion('new', key, progress, '2026-11-04', {})).toBe(true)
    expect(shouldAskReviewQuestion('new', key, progress, '2026-11-04', { [key]: 'missed' })).toBe(false)
    expect(shouldAskReviewQuestion('list', key, progress, '2026-11-04', {})).toBe(false)
  })

  it('builds four meaning options for a word card', () => {
    const cards = [
      word('a', 'kruh', 'hrana'),
      word('b', 'voda', 'piće'),
      word('c', 'stol', 'namještaj'),
      word('d', 'more', 'priroda'),
      word('e', 'sunce', 'nebo')
    ]
    const question = buildLearnReviewQuestion(pool(cards), 'word:a')
    expect(question).not.toBeNull()
    expect(question!.options.length).toBeGreaterThanOrEqual(3)
    expect(question!.correct).toBeGreaterThanOrEqual(0)
    expect(question!.options[question!.correct]!.hr).toBe('hrana')
  })
})
