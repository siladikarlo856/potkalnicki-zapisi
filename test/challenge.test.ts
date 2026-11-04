import { describe, expect, it } from 'vitest'
import type { WordEntry } from '../app/types/heritage'
import { challengeNickname } from '../shared/utils/challenge'
import { challengeOverview, generatedChallengeContent, parseGenerateInput, quizChallengeContent } from '../server/utils/challengeContent'
import { validateChallengeContent } from '../shared/utils/content/challengeTemplate'
import { mulberry32 } from '../shared/utils/games/rng'
import { generateQuestions } from '../shared/utils/games/questions'
import { fixtureCardPool } from './fixtures/gamePool'
import sample from './fixtures/heritage/challenge.json'

// The seeded current template, as a fixed challenge snapshots it (version from the template revision).
const currentChallengeContent = validateChallengeContent(sample)

const words: WordEntry[] = [
  { id: 'hiza', headword: 'hiža', meaning: { hr: 'kuća', en: 'house' }, variants: [], status: 'placeholder', sources: [] },
  { id: 'vura', headword: 'vura', meaning: { hr: 'sat', en: 'clock' }, variants: [], status: 'placeholder', sources: [] },
  { id: 'zdenec', headword: 'zdenec', meaning: { hr: 'bunar', en: 'well' }, variants: [], status: 'placeholder', sources: [] }
]

describe('challenge editorial contract and nickname validation', () => {
  it('ships fifteen labelled sample multiple-choice questions without leaking them in the overview', () => {
    expect(currentChallengeContent.sample).toBe(true)
    expect(currentChallengeContent.rounds.map(r => r.questions.length)).toEqual([5, 5, 5])
    expect(challengeOverview(currentChallengeContent)).toMatchObject({ sample: true, maxScore: 1500 })
    expect(challengeOverview(currentChallengeContent).rounds.every(r => Object.keys(r).sort().join(',') === 'count,topic')).toBe(true)
    expect(JSON.stringify(challengeOverview(currentChallengeContent))).not.toMatch(/correct|explanation|options/)
  })
  it('rejects malformed content before it can create a challenge', () => {
    const content = structuredClone(currentChallengeContent)
    content.rounds[0]!.questions[0]!.correct = 4
    expect(() => validateChallengeContent(content)).toThrow('Invalid challenge content: rounds.0.questions.0.correct: Označi točan odgovor.')
    content.rounds[0]!.questions[0]!.correct = 0
    content.rounds[0]!.questions[0]!.options.splice(1)
    expect(() => validateChallengeContent(content)).toThrow('Invalid challenge content: rounds.0.questions.0.options: Pitanje treba barem 2 ponuđena odgovora.')
    expect(() => validateChallengeContent({ ...sample, version: 0 })).toThrow('Invalid challenge content: version')
  })
  it('accepts Croatian letters and normalizes whitespace; rejects markup, control characters and invalid length', () => {
    expect(challengeNickname('  Željko  Š.  ')).toBe('Željko Š.')
    expect(challengeNickname('Iva-2')).toBe('Iva-2')
    for (const value of ['a', 'x'.repeat(25), '<script>', 'Ana\nIva', 'ab\u200bcd', null, 5]) expect(challengeNickname(value)).toBeNull()
  })

  it('rebuilds a played quiz round from active word IDs with the same question and option order', () => {
    const content = quizChallengeContent({
      questions: [
        { id: 'hiza', optionIds: ['vura', 'hiza', 'zdenec'] },
        { id: 'zdenec', optionIds: ['zdenec', 'vura', 'hiza'] }
      ],
      results: [true, false]
    }, words)
    expect(content).toMatchObject({
      version: 1,
      sample: true,
      rounds: [{
        id: 'quiz',
        questions: [
          { id: 'quiz-hiza', options: [{ hr: 'sat', en: 'clock' }, { hr: 'kuća', en: 'house' }, { hr: 'bunar', en: 'well' }], correct: 1 },
          { id: 'quiz-zdenec', options: [{ hr: 'bunar', en: 'well' }, { hr: 'sat', en: 'clock' }, { hr: 'kuća', en: 'house' }], correct: 0 }
        ]
      }]
    })
    expect(content.rounds[0]!.questions[0]!.prompt).toEqual({
      hr: 'Što znači riječ „hiža”?',
      en: 'What does “hiža” mean?'
    })
    expect(() => validateChallengeContent(content)).not.toThrow()
    expect(content.meta).toEqual({ source: 'quiz', topics: ['rijeci'], game: 'znacenje' })
    expect(content.rounds[0]!.questions[0]!.card).toBe('word:hiza')
  })

  it('rejects quiz rounds with missing words, repeated choices, or mismatched results', () => {
    expect(() => quizChallengeContent({ questions: [{ id: 'missing', optionIds: ['hiza', 'vura'] }], results: [true] }, words)).toThrow('Invalid quiz challenge')
    expect(() => quizChallengeContent({ questions: [{ id: 'hiza', optionIds: ['hiza', 'hiza'] }], results: [true] }, words)).toThrow('Invalid quiz challenge')
    expect(() => quizChallengeContent({ questions: [{ id: 'hiza', optionIds: ['hiza', 'vura'] }], results: [] }, words)).toThrow('Invalid quiz challenge')
  })

  it('validates generate input and builds random challenges with meta and card fields', () => {
    const pool = fixtureCardPool()
    expect(() => parseGenerateInput({ topics: ['osobe'], game: 'karta-koje', difficulty: 'srednje', length: 10 }, pool)).toThrow()
    expect(parseGenerateInput({ topics: ['osobe'], game: 'osoba', difficulty: 'srednje', length: 10 }, pool).game).toBe('osoba')
    expect(() => parseGenerateInput({ topics: ['mjesta'], game: 'karta-koje', difficulty: 'srednje', length: 10 }, pool)).not.toThrow()
    expect(() => parseGenerateInput({ topics: ['rijeci'], game: 'karta-koje', difficulty: 'srednje', length: 10 }, pool)).toThrow()
    const mapQuestion = generateQuestions('karta-koje', pool, { topics: ['mjesta'], difficulty: 'srednje', count: 1, rng: mulberry32(1) })[0]
    expect(mapQuestion?.display).toMatchObject({ type: 'map-target', point: { lat: expect.any(Number), lng: expect.any(Number) } })
    const input = parseGenerateInput({ topics: ['rijeci', 'mjesta', 'bastina'], game: 'mjesovito', difficulty: 'srednje', length: 10 }, pool)
    const content = generatedChallengeContent(input, pool, mulberry32(1))
    expect(content.sample).toBe(false)
    expect(content.meta).toMatchObject({ source: 'random', game: 'mjesovito', difficulty: 'srednje' })
    expect(content.rounds.flatMap(r => r.questions).every(q => q.card)).toBe(true)
    expect(() => validateChallengeContent(content)).not.toThrow()
    const validated = validateChallengeContent(content)
    expect(validated.meta).toEqual(content.meta)
    expect(validated.rounds[0]!.questions[0]!.card).toBe(content.rounds[0]!.questions[0]!.card)
  })

  it('keeps legacy snapshots without meta or card unchanged', () => {
    const before = validateChallengeContent(sample)
    const after = validateChallengeContent(structuredClone(sample))
    expect(after).toEqual(before)
    expect(after.rounds[0]!.questions[0]!.card).toBeUndefined()
    expect(after.meta).toBeUndefined()
  })
})
