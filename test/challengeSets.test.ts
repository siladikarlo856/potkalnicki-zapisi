import { describe, expect, it } from 'vitest'
import sample from './fixtures/heritage/challenge.json'
import { challengeSetPublic } from '../server/utils/challengeContent'
import type { ChallengeTemplateContent } from '../shared/utils/content/challengeTemplate'

const { version: _version, ...content } = sample as ChallengeTemplateContent & { version: number }

describe('challengeSetPublic', () => {
  it('returns overview fields only, never question bodies or answers', () => {
    const withMeta: ChallengeTemplateContent = {
      ...content,
      meta: { source: 'set', topics: ['rijeci', 'mjesta'], difficulty: 'srednje' }
    }
    const view = challengeSetPublic('11111111-2222-4333-8444-555555555555', withMeta)
    expect(view).toMatchObject({
      id: '11111111-2222-4333-8444-555555555555',
      sample: true,
      title: content.title,
      meta: { source: 'set', topics: ['rijeci', 'mjesta'], difficulty: 'srednje' },
      rounds: content.rounds.map(r => ({ topic: r.topic, count: r.questions.length }))
    })
    const leaked = JSON.stringify(view)
    expect(leaked).not.toMatch(/correct|explanation|"options"/)
    expect(leaked).not.toContain('hiža')
  })
})
