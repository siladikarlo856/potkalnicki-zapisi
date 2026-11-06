import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WordEntry } from '../app/types/heritage'
import sample from './fixtures/heritage/challenge.json'

// The Challenge module (server/challenges) through its public interface. The database is the
// boundary faked here; the real heritage_challenge_action is covered in challenge.integration.test.ts.
const CODE = 'AbCdEfGhIjKlMnOp'
const words: WordEntry[] = ['hiza', 'vura', 'zdenec'].map(id => ({
  id, headword: id, meaning: { hr: `hr ${id}`, en: `en ${id}` }, variants: [], status: 'placeholder', sources: []
}))
const finished = { code: CODE, participant: { phase: 'finished', total: 100 } }
const playing = { code: CODE, participant: { phase: 'question', total: 0 } }
const snapshot = {
  ...sample,
  meta: { source: 'random', topics: ['rijeci'], game: 'mjesovito', difficulty: 'lako' },
  rounds: [{
    id: 'r', topic: { hr: 'Riječi', en: 'Words' },
    questions: ['word:a', 'word:a', 'place:b'].map((card, index) => ({
      id: `q${index}`, mechanic: 'multiple-choice', prompt: { hr: 'P', en: 'P' },
      options: [{ hr: '1', en: '1' }, { hr: '2', en: '2' }], correct: 0, explanation: { hr: 'E', en: 'E' }, card
    }))
  }]
}

let body: Record<string, unknown> = {}
let state: unknown = playing
let rpcError: { code: string, message: string } | null = null
let cookies: Record<string, string> = {}
const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ data: rpcError ? null : state, error: rpcError }))
const tables = vi.fn((table: string) => {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: table === 'heritage_challenges' ? { content: snapshot } : null, error: null })
  }
  return query
})

beforeEach(() => {
  rpc.mockClear()
  tables.mockClear()
  body = { nickname: 'Ana' }
  state = playing
  rpcError = null
  cookies = {}
  const globals: Record<string, unknown> = {
    useRuntimeConfig: () => ({ challengeRateLimit: { create: 10, join: 10, action: 10, windowSeconds: 60 } }),
    clientKey: () => 'client',
    isRateLimited: () => false,
    countRateLimit: () => {},
    assertSameOrigin: () => {},
    readJsonObject: async () => body,
    publicWords: async () => ({ words }),
    useDatabaseClient: () => ({ rpc, from: tables }),
    getRouterParam: () => CODE,
    getQuery: () => ({}),
    getCookie: (_event: unknown, name: string) => cookies[name],
    setCookie: (_event: unknown, name: string, value: string) => {
      cookies[name] = value
    },
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

const challenges = () => import('../server/challenges')
const event = {} as never
const action = () => rpc.mock.calls[0]![1]

describe('the Challenge module', () => {
  it('records a Quiz-result challenge already finished, with the Quiz results, in exactly one RPC call', async () => {
    body = {
      nickname: 'Ana',
      quiz: { questions: [{ id: 'hiza', optionIds: ['vura', 'hiza', 'zdenec'] }, { id: 'vura', optionIds: ['vura', 'zdenec'] }], results: [true, false] }
    }
    state = finished
    const { createChallenge } = await challenges()
    await expect(createChallenge(event)).resolves.toBe(finished)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('heritage_challenge_action', expect.objectContaining({
      p_action: 'create_completed',
      p_input: expect.objectContaining({ nickname: 'Ana', results: [true, false], content: expect.objectContaining({ rounds: expect.any(Array) }) })
    }))
    expect(Object.keys(cookies)).toEqual([`heritage_${action().p_code}`])
  })

  it('refuses an invalid Quiz-result challenge before reaching the database', async () => {
    body = { nickname: 'Ana', quiz: { questions: [{ id: 'missing', optionIds: ['hiza', 'vura'] }], results: [true] } }
    const { createChallenge } = await challenges()
    await expect(createChallenge(event)).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Invalid quiz challenge' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('joins a Participant under a nickname without sending any content', async () => {
    const { joinChallenge } = await challenges()
    await expect(joinChallenge(event)).resolves.toBe(playing)
    expect(action()).toMatchObject({ p_action: 'join', p_code: CODE, p_input: { nickname: 'Ana' } })
    expect(action().p_input).not.toHaveProperty('content')
    expect(cookies[`heritage_${CODE}`]).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('refuses an invalid nickname', async () => {
    body = { nickname: 'x' }
    const { joinChallenge } = await challenges()
    await expect(joinChallenge(event)).rejects.toMatchObject({ statusCode: 400 })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('answers the current question for the Participant holding the cookie', async () => {
    cookies[`heritage_${CODE}`] = 'a'.repeat(43)
    body = { questionId: 'q1', selected: 2 }
    const { answerChallenge } = await challenges()
    await answerChallenge(event)
    expect(action()).toMatchObject({ p_action: 'answer', p_code: CODE, p_hash: expect.stringMatching(/^[0-9a-f]{64}$/), p_input: { questionId: 'q1', selected: 2 } })
  })

  it('refuses an invalid answer before reaching the database', async () => {
    body = { questionId: 'q1', selected: 4 }
    const { answerChallenge } = await challenges()
    await expect(answerChallenge(event)).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Invalid answer' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('maps the database refusals to HTTP errors', async () => {
    rpcError = { code: 'PT404', message: 'Challenge not found' }
    const { readChallenge } = await challenges()
    await expect(readChallenge(event)).rejects.toMatchObject({ statusCode: 404, statusMessage: 'Challenge not found' })
  })

  it('reads the state together with the meta of the stored snapshot', async () => {
    const { readChallenge } = await challenges()
    await expect(readChallenge(event)).resolves.toEqual({ ...playing, meta: snapshot.meta })
    expect(action()).toMatchObject({ p_action: 'state', p_code: CODE, p_hash: null })
  })

  it('is the only server code that reaches the challenge tables and functions, and all the routes use', () => {
    const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
      .flatMap(entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)])
    const server = fileURLToPath(new URL('../server/', import.meta.url))
    const reaching = files(server).filter(file => /heritage_challenge_(action|scoreboard)|['"]heritage_challenges['"]/.test(readFileSync(file, 'utf8')))
    expect(reaching.map(file => relative(server, file))).toEqual(['challenges/database.ts'])
    const routes = files(join(server, 'api/challenges'))
    for (const route of routes) {
      const imports = [...readFileSync(route, 'utf8').matchAll(/from '([^']+)'/g)].map(match => match[1])
      expect(imports, relative(server, route)).toEqual([expect.stringMatching(/^(\.\.\/)+challenges$/)])
    }
  })

  it('lists the cards behind the questions only once the Participant has finished', async () => {
    const { readChallengeCards } = await challenges()
    await expect(readChallengeCards(event)).rejects.toMatchObject({ statusCode: 409 })
    state = finished
    await expect(readChallengeCards(event)).resolves.toEqual({ cards: ['word:a', 'place:b'] })
  })
})
