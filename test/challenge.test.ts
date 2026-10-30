import { describe, expect, it } from 'vitest'
import { challengeNickname } from '../shared/utils/challenge'
import { challengeOverview, currentChallengeContent, validateChallengeContent } from '../server/utils/challengeContent'

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
    content.rounds[0]!.questions[0]!.options.pop()
    expect(() => validateChallengeContent(content)).toThrow('Invalid challenge question')
  })
  it('accepts Croatian letters and normalizes whitespace; rejects markup, control characters and invalid length', () => {
    expect(challengeNickname('  Željko  Š.  ')).toBe('Željko Š.')
    expect(challengeNickname('Iva-2')).toBe('Iva-2')
    for (const value of ['a', 'x'.repeat(25), '<script>', 'Ana\nIva', 'ab\u200bcd', null, 5]) expect(challengeNickname(value)).toBeNull()
  })
})
