import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WordEntry } from '../app/types/heritage'

// Creating a Quiz-result challenge talks to Postgres through one RPC. The database is the
// boundary mocked here; the real create_completed action is covered in challenge.integration.test.ts.
const words: WordEntry[] = ['hiza', 'vura', 'zdenec'].map(id => ({
  id, headword: id, meaning: { hr: `hr ${id}`, en: `en ${id}` }, variants: [], status: 'placeholder', sources: []
}))
const finished = { code: 'x', participant: { phase: 'finished', total: 100 } }
const rpc = vi.fn(async () => ({ data: finished, error: null }))

beforeEach(() => {
  rpc.mockClear()
  const globals: Record<string, unknown> = {
    useRuntimeConfig: () => ({ challengeRateLimit: { create: 10, join: 10, action: 10, windowSeconds: 60 } }),
    clientKey: () => 'client',
    isRateLimited: () => false,
    countRateLimit: () => {},
    assertSameOrigin: () => {},
    readJsonObject: async () => ({
      nickname: 'Ana',
      quiz: { questions: [{ id: 'hiza', optionIds: ['vura', 'hiza', 'zdenec'] }, { id: 'vura', optionIds: ['vura', 'zdenec'] }], results: [true, false] }
    }),
    publicWords: async () => ({ words }),
    useDatabaseClient: () => ({ rpc }),
    getCookie: () => undefined,
    setCookie: () => {},
    getRequestURL: () => new URL('http://localhost/api/challenges'),
    setResponseStatus: () => {},
    createError: (error: object) => Object.assign(new Error('error'), error),
    databaseError: (error: unknown) => {
      throw error
    }
  }
  for (const [name, value] of Object.entries(globals)) vi.stubGlobal(name, value)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Quiz-result challenge creation', () => {
  it('records the finished challenge with the Quiz results in exactly one RPC call', async () => {
    const { enterChallenge } = await import('../server/utils/challenges')
    const state = await enterChallenge({} as never, true)
    expect(state).toBe(finished)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('heritage_challenge_action', expect.objectContaining({
      p_action: 'create_completed',
      p_input: expect.objectContaining({ nickname: 'Ana', results: [true, false], content: expect.objectContaining({ rounds: expect.any(Array) }) })
    }))
  })
})
