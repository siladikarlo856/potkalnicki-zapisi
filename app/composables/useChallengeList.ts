import { computed, onMounted, readonly, ref } from 'vue'
import { useState } from '#imports'
import type { ChallengeLeaderboard, ChallengeState } from '~~/shared/utils/challenge'
import {
  CHALLENGE_LIST_MAX_REFRESH,
  CHALLENGE_LIST_STORAGE_KEY,
  decodeChallengeList,
  groupChallengeItems,
  newPlayersCount,
  pickHomeChallengeHighlight,
  storedFromState,
  upsertChallengeItem,
  type ChallengeListRole,
  type ChallengeListV1,
  type StoredChallenge
} from '~~/shared/utils/challengeList'

export {
  CHALLENGE_LIST_STORAGE_KEY,
  decodeChallengeList,
  groupChallengeItems,
  mergeChallengeRole,
  newPlayersCount,
  pickHomeChallengeHighlight,
  type ChallengeListRole,
  type ChallengeListV1,
  type StoredChallenge
} from '~~/shared/utils/challengeList'

const emptyList = (): ChallengeListV1 => ({ version: 1, items: [] })

/** Device-local list of friend challenges for resume and hub navigation. */
export function useChallengeList() {
  const list = useState<ChallengeListV1>('pz-challenge-list', emptyList)
  const loaded = useState('pz-challenge-list-loaded', () => false)
  const leaderboardCounts = useState<Record<string, number>>('pz-challenge-leaderboard-counts', () => ({}))

  function persist(next: ChallengeListV1) {
    list.value = next
    if (!import.meta.client) return
    try {
      window.localStorage.setItem(CHALLENGE_LIST_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Keep in-memory list when storage is unavailable.
    }
  }

  function load() {
    if (!import.meta.client || loaded.value) return
    loaded.value = true
    try {
      list.value = decodeChallengeList(window.localStorage.getItem(CHALLENGE_LIST_STORAGE_KEY))
    } catch {
      list.value = emptyList()
    }
  }

  onMounted(load)

  function find(code: string) {
    load()
    return (list.value ?? emptyList()).items.find(item => item.code === code)
  }

  function remember(state: ChallengeState, role: ChallengeListRole) {
    if (!import.meta.client || !state.code) return
    load()
    const previous = find(state.code)
    const item = storedFromState(state, role, previous)
    persist({ version: 1, items: upsertChallengeItem((list.value ?? emptyList()).items, item) })
  }

  function update(state: ChallengeState) {
    if (!import.meta.client || !state.code) return
    load()
    const previous = find(state.code)
    if (!previous) return
    const item = storedFromState(state, previous.role, previous)
    persist({ version: 1, items: upsertChallengeItem((list.value ?? emptyList()).items, item) })
  }

  function markSeen(code: string, count: number) {
    if (!import.meta.client || !code || !Number.isInteger(count) || count < 0) return
    load()
    const previous = find(code)
    if (!previous) return
    persist({
      version: 1,
      items: upsertChallengeItem(list.value.items, { ...previous, lastSeenCount: count })
    })
    leaderboardCounts.value = { ...leaderboardCounts.value, [code]: count }
  }

  function forget(code: string) {
    if (!import.meta.client || !code) return
    load()
    persist({ version: 1, items: (list.value ?? emptyList()).items.filter(item => item.code !== code) })
    leaderboardCounts.value = Object.fromEntries(
      Object.entries(leaderboardCounts.value).filter(([key]) => key !== code)
    )
  }

  const items = computed(() => (list.value ?? emptyList()).items)
  const groups = computed(() => groupChallengeItems((list.value ?? emptyList()).items))
  const totalCount = computed(() => (list.value ?? emptyList()).items.length)
  const homeHighlight = computed(() => pickHomeChallengeHighlight((list.value ?? emptyList()).items, leaderboardCounts.value))

  const refreshBudget = ref(CHALLENGE_LIST_MAX_REFRESH)

  async function refreshItem(code: string, options?: { fetchLeaderboard?: boolean }) {
    if (refreshBudget.value <= 0) return
    refreshBudget.value -= 1
    try {
      const state = await $fetch<ChallengeState>(`/api/challenges/${code}`)
      update(state)
      if (options?.fetchLeaderboard) {
        const board = await $fetch<ChallengeLeaderboard>(`/api/challenges/${code}/ljestvica`)
        leaderboardCounts.value = { ...leaderboardCounts.value, [code]: board.count }
      }
    } catch (cause) {
      const failure = cause as { status?: number, statusCode?: number }
      if ((failure.status ?? failure.statusCode) === 404) forget(code)
    }
  }

  async function refreshMany(codes: string[], options?: { fetchLeaderboard?: boolean }) {
    for (const code of codes) {
      if (refreshBudget.value <= 0) break
      await refreshItem(code, options)
    }
  }

  function resetRefreshBudget(max = CHALLENGE_LIST_MAX_REFRESH) {
    refreshBudget.value = max
  }

  function newPlayersFor(item: StoredChallenge) {
    return newPlayersCount(item, leaderboardCounts.value[item.code])
  }

  return {
    items,
    groups,
    totalCount,
    homeHighlight,
    leaderboardCounts: readonly(leaderboardCounts),
    loaded: readonly(loaded),
    find,
    remember,
    update,
    markSeen,
    forget,
    refreshItem,
    refreshMany,
    resetRefreshBudget,
    newPlayersFor,
    load
  }
}
