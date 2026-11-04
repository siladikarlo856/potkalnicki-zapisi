import type { ChallengeState } from './challenge'

export type ChallengeListRole = 'creator' | 'player' | 'visitor'

export interface StoredChallengeLast {
  phase: string
  index: number
  total: number
  questionCount: number
  completedAt: string | null
  closed: boolean
}

export interface StoredChallenge {
  code: string
  title: string
  role: ChallengeListRole
  addedAt: string
  closesAt: string
  lastSeenCount?: number
  last?: StoredChallengeLast
}

export interface ChallengeListV1 {
  version: 1
  items: StoredChallenge[]
}

export const CHALLENGE_LIST_STORAGE_KEY = 'pz-challenges/v1'
export const CHALLENGE_LIST_MAX_ITEMS = 30
export const CHALLENGE_LIST_MAX_REFRESH = 10

const ROLE_RANK: Record<ChallengeListRole, number> = { visitor: 0, player: 1, creator: 2 }

const IN_PROGRESS_PHASES = new Set(['ready', 'question', 'feedback', 'round'])

const emptyList = (): ChallengeListV1 => ({ version: 1, items: [] })

function validIso(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function validRole(value: unknown): value is ChallengeListRole {
  return value === 'creator' || value === 'player' || value === 'visitor'
}

function validLast(value: unknown): value is StoredChallengeLast {
  if (!value || typeof value !== 'object') return false
  const last = value as StoredChallengeLast
  return typeof last.phase === 'string'
    && Number.isInteger(last.index) && last.index >= 0
    && Number.isInteger(last.total) && last.total >= 0
    && Number.isInteger(last.questionCount) && last.questionCount >= 0
    && (last.completedAt === null || validIso(last.completedAt))
    && typeof last.closed === 'boolean'
}

function validItem(value: unknown): value is StoredChallenge {
  if (!value || typeof value !== 'object') return false
  const item = value as StoredChallenge
  return typeof item.code === 'string' && item.code.length > 0
    && typeof item.title === 'string'
    && validRole(item.role)
    && validIso(item.addedAt)
    && validIso(item.closesAt)
    && (item.lastSeenCount === undefined || (Number.isInteger(item.lastSeenCount) && item.lastSeenCount >= 0))
    && (item.last === undefined || validLast(item.last))
}

export function decodeChallengeList(raw: string | null): ChallengeListV1 {
  if (!raw) return emptyList()
  try {
    const data = JSON.parse(raw)
    if (!data || data.version !== 1 || !Array.isArray(data.items)) return emptyList()
    const items: StoredChallenge[] = []
    for (const entry of data.items) {
      if (!validItem(entry)) return emptyList()
      items.push(entry)
    }
    return { version: 1, items }
  } catch {
    return emptyList()
  }
}

export function mergeChallengeRole(current: ChallengeListRole, next: ChallengeListRole): ChallengeListRole {
  return ROLE_RANK[next] > ROLE_RANK[current] ? next : current
}

export function lastFromChallengeState(state: ChallengeState): StoredChallengeLast {
  const participant = state.participant
  if (!participant) {
    return {
      phase: 'ready',
      index: 0,
      total: state.questionCount,
      questionCount: state.questionCount,
      completedAt: null,
      closed: state.closed
    }
  }
  return {
    phase: participant.phase,
    index: participant.index,
    total: participant.total,
    questionCount: state.questionCount,
    completedAt: participant.completedAt,
    closed: state.closed
  }
}

export function storedFromState(state: ChallengeState, role: ChallengeListRole, previous?: StoredChallenge): StoredChallenge {
  const now = new Date().toISOString()
  return {
    code: state.code,
    title: state.title.hr,
    role: previous ? mergeChallengeRole(previous.role, role) : role,
    addedAt: previous?.addedAt ?? now,
    closesAt: state.closesAt,
    lastSeenCount: previous?.lastSeenCount,
    last: lastFromChallengeState(state)
  }
}

export function isChallengeInProgress(item: StoredChallenge): boolean {
  if (item.role === 'visitor') return false
  const last = item.last
  if (!last || last.closed || last.completedAt) return false
  if (last.phase === 'finished') return false
  return IN_PROGRESS_PHASES.has(last.phase)
}

export function isChallengeWaiting(item: StoredChallenge): boolean {
  if (item.role !== 'visitor') return false
  const last = item.last
  if (last?.closed) return false
  if (last?.completedAt) return false
  return true
}

export type ChallengeListGroup = 'yours' | 'inProgress' | 'waiting' | 'finished'

/** Assign each item to exactly one group (first matching rule wins). */
export function challengeListGroup(item: StoredChallenge): ChallengeListGroup {
  if (item.role === 'creator') return 'yours'
  if (isChallengeInProgress(item)) return 'inProgress'
  if (isChallengeWaiting(item)) return 'waiting'
  return 'finished'
}

export function groupChallengeItems(items: StoredChallenge[]) {
  const groups: Record<ChallengeListGroup, StoredChallenge[]> = {
    yours: [],
    inProgress: [],
    waiting: [],
    finished: []
  }
  for (const item of items) groups[challengeListGroup(item)].push(item)
  return groups
}

export function newPlayersCount(item: StoredChallenge, leaderboardCount: number | undefined): number {
  if (item.role !== 'creator') return 0
  if (leaderboardCount === undefined) return 0
  const seen = item.lastSeenCount ?? 0
  return Math.max(0, leaderboardCount - seen)
}

/** Home resume card priority: in-progress group → waiting → your challenge with new players. */
export function pickHomeChallengeHighlight(
  items: StoredChallenge[],
  leaderboardCounts: Record<string, number | undefined>
): StoredChallenge | null {
  const inProgress = items.filter(item => challengeListGroup(item) === 'inProgress')
  if (inProgress[0]) return inProgress[0]
  const waiting = items.filter(item => challengeListGroup(item) === 'waiting')
  if (waiting[0]) return waiting[0]
  return items.find(item => newPlayersCount(item, leaderboardCounts[item.code]) > 0) ?? null
}

export function upsertChallengeItem(items: StoredChallenge[], next: StoredChallenge): StoredChallenge[] {
  const without = items.filter(item => item.code !== next.code)
  return [next, ...without].slice(0, CHALLENGE_LIST_MAX_ITEMS)
}

export function localDayString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function daysUntilClose(closesAt: string, today = localDayString()): number {
  const closeDay = closesAt.slice(0, 10)
  const dayMs = 86_400_000
  const start = Date.parse(`${today}T00:00:00`)
  const end = Date.parse(`${closeDay}T00:00:00`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.max(0, Math.ceil((end - start) / dayMs))
}
