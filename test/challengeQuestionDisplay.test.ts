import { describe, expect, it } from 'vitest'
import { validateQuestionDisplay } from '../shared/utils/content/challengeTemplate'

describe('validateQuestionDisplay', () => {
  const issues: Array<{ path: string, message: string }> = []
  const add = (path: string, message: string) => {
    issues.push({ path, message })
  }

  it('accepts map-target inside MAP_FRAME slack', () => {
    issues.length = 0
    const value = validateQuestionDisplay(
      { type: 'map-target', point: { lat: 46.05, lng: 16.5 } },
      'rounds.0.questions.0',
      4,
      '',
      add
    )
    expect(issues).toEqual([])
    expect(value).toEqual({ type: 'map-target', point: { lat: 46.05, lng: 16.5 } })
  })

  it('requires map-points length to match options', () => {
    issues.length = 0
    expect(validateQuestionDisplay(
      { type: 'map-points', points: [{ lat: 46.05, lng: 16.5 }] },
      'q',
      4,
      'content.',
      add
    )).toBeUndefined()
    expect(issues[0]?.path).toBe('content.q.display')
  })

  it('rejects coordinates outside MAP_FRAME ±0.05°', () => {
    issues.length = 0
    expect(validateQuestionDisplay(
      { type: 'map-target', point: { lat: 45, lng: 16.5 } },
      'q',
      2,
      '',
      add
    )).toBeUndefined()
    expect(issues[0]?.message).toContain('području')
  })
})
