import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearNuxtState } from '#imports'
import type { ChallengeState } from '../shared/utils/challenge'
import {
  CHALLENGE_LIST_MAX_ITEMS,
  CHALLENGE_LIST_STORAGE_KEY,
  challengeListGroup,
  decodeChallengeList,
  groupChallengeItems,
  mergeChallengeRole,
  newPlayersCount,
  pickHomeChallengeHighlight,
  storedFromState,
  upsertChallengeItem,
  type StoredChallenge
} from '../shared/utils/challengeList'

function sampleState(over: Partial<ChallengeState> = {}): ChallengeState {
  return {
    code: 'abc12',
    title: { hr: 'Test izazov', en: 'Test' },
    sample: false,
    createdAt: '2026-11-01T10:00:00.000Z',
    closesAt: '2026-11-08T10:00:00.000Z',
    closed: false,
    questionCount: 10,
    maxScore: 1000,
    targetScore: null,
    rounds: [{ topic: { hr: 'Riječi', en: 'Words' }, count: 10 }],
    participant: {
      nickname: 'Ana',
      phase: 'question',
      index: 3,
      total: 10,
      completedAt: null,
      rounds: []
    },
    question: null,
    feedback: null,
    ...over
  }
}

function item(over: Partial<StoredChallenge> = {}): StoredChallenge {
  return {
    code: 'abc12',
    title: 'Test',
    role: 'player',
    addedAt: '2026-11-01T10:00:00.000Z',
    closesAt: '2026-11-08T10:00:00.000Z',
    last: {
      phase: 'question',
      index: 3,
      total: 10,
      questionCount: 10,
      completedAt: null,
      closed: false
    },
    ...over
  }
}

describe('challengeList storage', () => {
  it('returns empty list for malformed storage', () => {
    expect(decodeChallengeList('{bad')).toEqual({ version: 1, items: [] })
    expect(decodeChallengeList(JSON.stringify({ version: 2, items: [] }))).toEqual({ version: 1, items: [] })
  })

  it('caps the list at 30 items with newest first', () => {
    let items: StoredChallenge[] = []
    for (let i = 0; i < 35; i++) {
      items = upsertChallengeItem(items, item({ code: `c${i}`, addedAt: `2026-11-01T10:00:${String(i).padStart(2, '0')}.000Z` }))
    }
    expect(items).toHaveLength(CHALLENGE_LIST_MAX_ITEMS)
    expect(items[0]?.code).toBe('c34')
  })
})

describe('challengeList roles and grouping', () => {
  it('upgrades roles only upward', () => {
    expect(mergeChallengeRole('visitor', 'player')).toBe('player')
    expect(mergeChallengeRole('player', 'creator')).toBe('creator')
    expect(mergeChallengeRole('creator', 'player')).toBe('creator')
  })

  it('assigns groups in handbook order', () => {
    const table: Array<[StoredChallenge, ReturnType<typeof challengeListGroup>]> = [
      [item({ role: 'creator' }), 'yours'],
      [item({ role: 'player', last: { phase: 'question', index: 1, total: 10, questionCount: 10, completedAt: null, closed: false } }), 'inProgress'],
      [item({ role: 'visitor', last: { phase: 'ready', index: 0, total: 10, questionCount: 10, completedAt: null, closed: false } }), 'waiting'],
      [item({ role: 'player', last: { phase: 'finished', index: 10, total: 10, questionCount: 10, completedAt: '2026-11-02T10:00:00.000Z', closed: false } }), 'finished']
    ]
    for (const [entry, group] of table) expect(challengeListGroup(entry)).toBe(group)
    const grouped = groupChallengeItems(table.map(([entry]) => entry))
    expect(grouped.yours).toHaveLength(1)
    expect(grouped.inProgress).toHaveLength(1)
    expect(grouped.waiting).toHaveLength(1)
    expect(grouped.finished).toHaveLength(1)
  })

  it('computes new player counts for creators', () => {
    const creator = item({ role: 'creator', lastSeenCount: 2 })
    expect(newPlayersCount(creator, 5)).toBe(3)
    expect(newPlayersCount(creator, 1)).toBe(0)
    expect(newPlayersCount(item({ role: 'player' }), 5)).toBe(0)
  })

  it('prefers in-progress for the home highlight', () => {
    const waiting = item({ code: 'wait', role: 'visitor' })
    const active = item({ code: 'play', role: 'player' })
    const creator = item({ code: 'mine', role: 'creator', lastSeenCount: 0 })
    expect(pickHomeChallengeHighlight([waiting, creator, active], { mine: 4 })?.code).toBe('play')
    expect(pickHomeChallengeHighlight([waiting, creator], { mine: 2 })?.code).toBe('wait')
    expect(pickHomeChallengeHighlight([creator], { mine: 2 })?.code).toBe('mine')
  })
})

describe('useChallengeList composable', () => {
  beforeEach(() => {
    localStorage.clear()
    clearNuxtState(['pz-challenge-list', 'pz-challenge-list-loaded', 'pz-challenge-leaderboard-counts'])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('forget removes a code after a 404 refresh', async () => {
    const { useChallengeList } = await import('../app/composables/useChallengeList')
    const list = useChallengeList()
    list.remember(sampleState(), 'player')
    expect(list.items.value).toHaveLength(1)
    vi.stubGlobal('$fetch', vi.fn(async () => {
      throw { status: 404 }
    }))
    await list.refreshItem('abc12')
    expect(list.items.value).toHaveLength(0)
  })

  it('persists remembered challenges', async () => {
    const { useChallengeList } = await import('../app/composables/useChallengeList')
    const list = useChallengeList()
    list.remember(sampleState(), 'creator')
    const raw = localStorage.getItem(CHALLENGE_LIST_STORAGE_KEY)
    expect(raw).toContain('abc12')
    expect(storedFromState(sampleState(), 'player').role).toBe('player')
  })
})
