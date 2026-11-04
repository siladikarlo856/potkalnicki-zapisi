import { describe, expect, it } from 'vitest'
import {
  answerInSession,
  createSession,
  parseCardKeyList,
  sessionComplete
} from '../shared/utils/learn/learnState'
import type { CardKey } from '../shared/utils/learn/types'

describe('learn session runner', () => {
  const keys = ['word:a', 'word:b', 'word:c'] as CardKey[]

  it('requeues on Ne znam exactly once per card key', () => {
    let session = createSession(['rijeci'], 3, keys, 'new')
    session = answerInSession(session, false)
    expect(session.requeued).toEqual(['word:a'])
    expect(session.queue.filter(k => k === 'word:a').length).toBe(2)
    session = answerInSession(session, true)
    session = answerInSession(session, true)
    session = answerInSession(session, false)
    expect(session.requeued).toEqual(['word:a'])
  })

  it('keeps custom kartice order and ignores invalid keys', () => {
    const valid = new Set(keys)
    const parsed = parseCardKeyList('word:c, bad, word:a', valid)
    expect(parsed).toEqual(['word:c', 'word:a'])
  })

  it('completes when index reaches queue length', () => {
    let session = createSession(['rijeci'], 2, keys.slice(0, 2), 'new')
    session = answerInSession(session, true)
    session = answerInSession(session, true)
    expect(sessionComplete(session)).toBe(true)
  })
})
