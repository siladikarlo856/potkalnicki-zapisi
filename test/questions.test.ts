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
  it('rijec asks for the local word and records the card behind each option', () => {
    const questions = generateQuestions('rijec', pool, { topics: ['rijeci'], difficulty: 'srednje', count: 4, rng: mulberry32(5) })
    expect(questions.length).toBeGreaterThan(0)
    for (const question of questions) {
      expect(question.gameId).toBe('rijec')
      expect(question.prompt.hr).toMatch(/^Kak se kod nas veli „.+”\?$/)
      expect(question.prompt.en).toMatch(/^Which local word means “.+”\?$/)
      expect(question.options[question.correct]!.hr).toBe(question.explanation.hr.match(/se kod nas veli „(.+)”\.$/)![1])
      expect(question.optionCards).toHaveLength(question.options.length)
      expect(question.optionCards![question.correct]).toBe(question.card)
    }
  })

  it('znacenje records optionCards in option order', () => {
    const questions = generateQuestions('znacenje', pool, { topics: ['rijeci'], difficulty: 'srednje', count: 4, rng: mulberry32(11) })
    for (const question of questions) {
      expect(question.optionCards).toHaveLength(question.options.length)
      expect(question.optionCards![question.correct]).toBe(question.card)
      const words = pool.cards.filter(card => card.kind === 'word')
      question.optionCards!.forEach((key, i) => {
        const word = words.find(card => card.key === key)!
        expect('meaning' in word && word.meaning).toBe(question.options[i]!.hr)
      })
    }
  })

  it('place and item games do not set optionCards', () => {
    for (const game of ['opcina', 'crkva'] as const) {
      const questions = generateQuestions(game, pool, { topics: ['mjesta', 'bastina'], difficulty: 'srednje', count: 2, rng: mulberry32(3) })
      for (const question of questions) expect(question.optionCards).toBeUndefined()
    }
  })

  it('asks community words only in solo play (wordStatus any)', () => {
    const community = { ...pool, cards: pool.cards.map(card => card.kind === 'word' ? { ...card, status: 'community' as const } : card) }
    const base = { topics: ['rijeci'], difficulty: 'srednje' as const, count: 4 }
    expect(generateQuestions('rijec', community, { ...base, rng: mulberry32(2) })).toEqual([])
    expect(generateQuestions('rijec', community, { ...base, rng: mulberry32(2), wordStatus: 'any' }).length).toBeGreaterThan(0)
  })
})
