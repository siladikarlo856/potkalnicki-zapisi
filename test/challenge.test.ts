import { describe, expect, it } from 'vitest'
import type { WordEntry } from '../app/types/heritage'
import { challengeNickname } from '../shared/utils/challenge'
import { challengeOverview, currentChallengeContent, quizChallengeContent, validateChallengeContent } from '../server/utils/challengeContent'

const words: WordEntry[] = [
  { id: 'hiza', headword: 'hiža', meaning: { hr: 'kuća', en: 'house' }, variants: [], status: 'placeholder', sources: [] },
  { id: 'vura', headword: 'vura', meaning: { hr: 'sat', en: 'clock' }, variants: [], status: 'placeholder', sources: [] },
  { id: 'zdenec', headword: 'zdenec', meaning: { hr: 'bunar', en: 'well' }, variants: [], status: 'placeholder', sources: [] }
]

describe('challenge editorial contract and nickname validation', () => {
  it('ships fifteen labelled sample multiple-choice questions without leaking them in the overview', () => {
    expect(currentChallengeContent.sample).toBe(true)
    expect(currentChallengeContent.rounds.map(r => r.questions.length)).toEqual([5, 5, 5])
    expect(challengeOverview()).toMatchObject({ sample: true, maxScore: 1500 })
    expect(challengeOverview().rounds.every(r => Object.keys(r).sort().join(',') === 'count,topic')).toBe(true)
  })
  it('rejects malformed content before it can create a challenge', () => {
    const content = structuredClone(currentChallengeContent)
    content.rounds[0]!.questions[0]!.correct = 4
    expect(() => validateChallengeContent(content)).toThrow('Invalid challenge question')
    content.rounds[0]!.questions[0]!.correct = 0
    content.rounds[0]!.questions[0]!.options.splice(1)
    expect(() => validateChallengeContent(content)).toThrow('Invalid challenge question')
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
  })

  it('rejects quiz rounds with missing words, repeated choices, or mismatched results', () => {
    expect(() => quizChallengeContent({ questions: [{ id: 'missing', optionIds: ['hiza', 'vura'] }], results: [true] }, words)).toThrow('Invalid quiz challenge')
    expect(() => quizChallengeContent({ questions: [{ id: 'hiza', optionIds: ['hiza', 'hiza'] }], results: [true] }, words)).toThrow('Invalid quiz challenge')
    expect(() => quizChallengeContent({ questions: [{ id: 'hiza', optionIds: ['hiza', 'vura'] }], results: [] }, words)).toThrow('Invalid quiz challenge')
  })
})
