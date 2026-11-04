import { describe, expect, it } from 'vitest'
import { challengeQuestionCards } from '../server/utils/challenges'
import { validateChallengeContent } from '../shared/utils/content/challengeTemplate'
import sample from './fixtures/heritage/challenge.json'
import { generatedChallengeContent, parseGenerateInput } from '../server/utils/challengeContent'
import { mulberry32 } from '../shared/utils/games/rng'
import { fixtureCardPool } from './fixtures/gamePool'

describe('challengeQuestionCards', () => {
  it('deduplicates card keys in question order', () => {
    const content = validateChallengeContent({
      ...sample,
      version: 1,
      rounds: [{
        id: 'r',
        topic: { hr: 'Riječi', en: 'Words' },
        questions: [
          { id: 'a', mechanic: 'multiple-choice', prompt: { hr: 'A', en: 'A' }, options: [{ hr: '1', en: '1' }, { hr: '2', en: '2' }], correct: 0, explanation: { hr: 'E', en: 'E' }, card: 'word:w1' },
          { id: 'b', mechanic: 'multiple-choice', prompt: { hr: 'B', en: 'B' }, options: [{ hr: '1', en: '1' }, { hr: '2', en: '2' }], correct: 0, explanation: { hr: 'E', en: 'E' }, card: 'word:w1' },
          { id: 'c', mechanic: 'multiple-choice', prompt: { hr: 'C', en: 'C' }, options: [{ hr: '1', en: '1' }, { hr: '2', en: '2' }], correct: 0, explanation: { hr: 'E', en: 'E' }, card: 'place:p1' }
        ]
      }]
    })
    expect(challengeQuestionCards(content)).toEqual(['word:w1', 'place:p1'])
  })

  it('reads cards from generated challenges', () => {
    const pool = fixtureCardPool()
    const input = parseGenerateInput({ topics: ['rijeci', 'mjesta', 'bastina'], game: 'mjesovito', difficulty: 'srednje', length: 10 }, pool)
    const content = generatedChallengeContent(input, pool, mulberry32(9))
    const cards = challengeQuestionCards(content)
    expect(cards.length).toBeGreaterThan(0)
    expect(new Set(cards).size).toBe(cards.length)
  })
})
