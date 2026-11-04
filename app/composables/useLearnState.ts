import { computed, onMounted, readonly } from 'vue'
import { useState } from '#imports'
import type { TopicId } from '~~/shared/utils/learn/types'
import {
  LEARN_STORAGE_KEY,
  decodeLearnState,
  emptyLearnState,
  type LearnCurrent,
  type LearnN,
  type LearnStateV1
} from '~~/shared/utils/learn/learnState'

export { LEARN_STORAGE_KEY } from '~~/shared/utils/learn/learnState'

/** Device-local learn session state (H4.4). */
export function useLearnState() {
  const state = useState<LearnStateV1>('pz-learn-state', emptyLearnState)
  const loaded = useState('pz-learn-loaded', () => false)

  function persist(next: LearnStateV1) {
    state.value = next
    if (!import.meta.client) return
    try {
      window.localStorage.setItem(LEARN_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // keep in-memory state when storage fails
    }
  }

  function load() {
    if (!import.meta.client || loaded.value) return
    loaded.value = true
    try {
      state.value = decodeLearnState(window.localStorage.getItem(LEARN_STORAGE_KEY))
    } catch {
      state.value = emptyLearnState()
    }
  }

  onMounted(load)

  const snapshot = () => state.value ?? emptyLearnState()

  function setCurrent(current: LearnCurrent | null) {
    load()
    persist({ ...snapshot(), current })
  }

  function rememberSetup(topics: TopicId[], n: LearnN) {
    load()
    persist({ ...snapshot(), lastTopics: topics.length ? topics : ['rijeci'], lastN: n })
  }

  function rememberPlace(place: string | undefined) {
    load()
    persist({ ...snapshot(), place: place || undefined })
  }

  return {
    state: readonly(state),
    current: computed(() => snapshot().current),
    lastTopics: computed(() => snapshot().lastTopics),
    lastN: computed(() => snapshot().lastN),
    place: computed(() => snapshot().place),
    loaded: readonly(loaded),
    load,
    setCurrent,
    rememberSetup,
    rememberPlace,
    patch: (patch: Partial<LearnStateV1>) => {
      load()
      persist({ ...snapshot(), ...patch })
    }
  }
}
