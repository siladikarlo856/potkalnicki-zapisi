import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../shared/utils/games/rng'
import { generateQuestions } from '../shared/utils/games/questions'
import { fixtureCardPool } from './fixtures/gamePool'

const CHALLENGE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/

describe('game question generators', () => {
  const pool = fixtureCardPool()
  const topics = ['rijeci', 'mjesta', 'bastina'] as const

  for (const game of ['znacenje', 'rijec', 'opcina', 'crkva'] as const) {
    it(`${game} returns valid multiple-choice questions`, () => {
      const questions = generateQuestions(game, pool, { topics: [...topics], difficulty: 'srednje', count: 3, rng: mulberry32(99) })
      expect(questions.length).toBeGreaterThan(0)
      for (const question of questions) {
        expect(question.id.length).toBeLessThanOrEqual(200)
        expect(CHALLENGE_ID_RE.test(question.id)).toBe(true)
        expect(question.correct).toBeGreaterThanOrEqual(0)
        expect(question.correct).toBeLessThan(question.options.length)
        for (const lang of ['hr', 'en'] as const) {
          const texts = question.options.map(o => o[lang].toLocaleLowerCase(lang))
          expect(new Set(texts).size).toBe(texts.length)
        }
        expect(question.prompt.en.length).toBeGreaterThan(0)
        expect(question.explanation.hr).not.toContain('notes')
        expect(question.explanation.en).not.toContain('notes')
      }
    })
  }

  it('prefers easy words and hard distractors at Lako for znacenje', () => {
    const questions = generateQuestions('znacenje', pool, { topics: ['rijeci'], difficulty: 'lako', count: 5, rng: mulberry32(7) })
    expect(questions.some(q => q.prompt.hr.includes('krumper') || q.prompt.hr.includes('avijon'))).toBe(true)
  })

  it('prefers hard words at Teško for znacenje', () => {
    const questions = generateQuestions('znacenje', pool, { topics: ['rijeci'], difficulty: 'tesko', count: 5, rng: mulberry32(8) })
    expect(questions.some(q => q.prompt.hr.includes('afinger'))).toBe(true)
  })
})
