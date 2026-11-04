import { CARD_KEY, type CardKey, type TopicId } from './types'

export const LEARN_STORAGE_KEY = 'pz-learn/v1'

export type LearnN = 5 | 10 | 20

export interface LearnCurrent {
  topics: TopicId[]
  n: LearnN
  place?: string
  queue: CardKey[]
  index: number
  requeued: CardKey[]
  results: Record<CardKey, 'known' | 'missed'>
  startedAt: string
  mode: 'new' | 'review' | 'list'
}

export interface LearnStateV1 {
  version: 1
  current: LearnCurrent | null
  lastTopics: TopicId[]
  lastN: LearnN
  place?: string
}

const VALID_N = new Set<LearnN>([5, 10, 20])

export function emptyLearnState(): LearnStateV1 {
  return { version: 1, current: null, lastTopics: ['rijeci'], lastN: 10 }
}

function validTopicId(value: unknown): value is TopicId {
  return typeof value === 'string' && value.length > 0 && value.length <= 64
}

function validCardKey(value: unknown): value is CardKey {
  return typeof value === 'string' && CARD_KEY.test(value)
}

function validCurrent(value: unknown): value is LearnCurrent {
  if (!value || typeof value !== 'object') return false
  const c = value as LearnCurrent
  if (!Array.isArray(c.topics) || !c.topics.every(validTopicId)) return false
  if (!VALID_N.has(c.n)) return false
  if (c.place !== undefined && typeof c.place !== 'string') return false
  if (!Array.isArray(c.queue) || !c.queue.every(validCardKey)) return false
  if (!Number.isInteger(c.index) || c.index < 0) return false
  if (!Array.isArray(c.requeued) || !c.requeued.every(validCardKey)) return false
  if (!c.results || typeof c.results !== 'object' || Array.isArray(c.results)) return false
  for (const key of Object.keys(c.results)) {
    if (!Object.hasOwn(c.results, key) || !validCardKey(key)) return false
    const v = c.results[key as CardKey]
    if (v !== 'known' && v !== 'missed') return false
  }
  if (typeof c.startedAt !== 'string' || !c.startedAt) return false
  if (c.mode !== 'new' && c.mode !== 'review' && c.mode !== 'list') return false
  return true
}

export function decodeLearnState(raw: string | null): LearnStateV1 {
  if (!raw) return emptyLearnState()
  try {
    const data = JSON.parse(raw)
    if (!data || data.version !== 1) return emptyLearnState()
    const lastTopics = Array.isArray(data.lastTopics) && data.lastTopics.every(validTopicId)
      ? data.lastTopics as TopicId[]
      : ['rijeci']
    const lastN = VALID_N.has(data.lastN) ? data.lastN as LearnN : 10
    const place = typeof data.place === 'string' ? data.place : undefined
    const current = data.current === null ? null : validCurrent(data.current) ? data.current : null
    return { version: 1, current, lastTopics, lastN, place }
  } catch {
    return emptyLearnState()
  }
}

/** Display index for "Kartica {i} od {n}" — distinct cards answered, plus one when the current card is new. */
export function sessionCardIndex(current: LearnCurrent): number {
  const answered = Object.keys(current.results).length
  const key = current.queue[current.index]
  if (!key) return Math.min(answered, current.n)
  return Object.hasOwn(current.results, key) ? Math.min(answered, current.n) : Math.min(answered + 1, current.n)
}

export function sessionComplete(current: LearnCurrent): boolean {
  return current.index >= current.queue.length
}

export function answerInSession(current: LearnCurrent, knew: boolean): LearnCurrent {
  const key = current.queue[current.index]
  if (!key) return current
  const results = { ...current.results }
  if (!Object.hasOwn(results, key)) results[key] = knew ? 'known' : 'missed'
  const queue = [...current.queue]
  let requeued = [...current.requeued]
  if (!knew && !requeued.includes(key)) {
    const insertAt = Math.min(current.index + 3, queue.length)
    queue.splice(insertAt, 0, key)
    requeued = [...requeued, key]
  }
  return {
    ...current,
    queue,
    requeued,
    results,
    index: current.index + 1
  }
}

export function filterCurrentToPool(current: LearnCurrent, validKeys: Set<CardKey>): LearnCurrent | null {
  const queue = current.queue.filter(k => validKeys.has(k))
  if (!queue.length) return null
  const results: LearnCurrent['results'] = {}
  for (const [key, value] of Object.entries(current.results)) {
    if (Object.hasOwn(current.results, key) && validKeys.has(key as CardKey)) {
      results[key as CardKey] = value
    }
  }
  const index = Math.min(current.index, queue.length)
  return { ...current, queue, results, index }
}

export function parseCardKeyList(raw: string | undefined, validKeys: Set<CardKey>, max = 20): CardKey[] {
  if (!raw) return []
  const out: CardKey[] = []
  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (!validCardKey(trimmed) || !validKeys.has(trimmed)) continue
    if (out.includes(trimmed)) continue
    out.push(trimmed)
    if (out.length >= max) break
  }
  return out
}

export function createSession(
  topics: TopicId[],
  n: LearnN,
  queue: CardKey[],
  mode: LearnCurrent['mode'],
  place?: string
): LearnCurrent {
  return {
    topics,
    n,
    place,
    queue,
    index: 0,
    requeued: [],
    results: {},
    startedAt: new Date().toISOString(),
    mode
  }
}
