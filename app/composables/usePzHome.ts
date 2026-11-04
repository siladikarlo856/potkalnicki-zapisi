import { onMounted, readonly, watch } from 'vue'
import { useState } from '#imports'

export const PZ_HOME_STORAGE_KEY = 'pz-home/v1'

export type PzHomeTab = 'uci' | 'igraj'

interface PzHomeState {
  version: 1
  tab: PzHomeTab
}

const defaultState = (): PzHomeState => ({ version: 1, tab: 'uci' })

function decode(raw: string | null): PzHomeState {
  if (!raw) return defaultState()
  try {
    const data = JSON.parse(raw)
    if (data?.version === 1 && (data.tab === 'uci' || data.tab === 'igraj')) return data as PzHomeState
  } catch {
    // malformed storage falls back to the default tab
  }
  return defaultState()
}

/** Remembers the last Uči | Igraj tab on the home page. */
export function usePzHome() {
  const tab = useState<PzHomeTab>('pz-home-tab', () => 'uci')
  const loaded = useState('pz-home-loaded', () => false)

  function load() {
    if (!import.meta.client || loaded.value) return
    loaded.value = true
    try {
      tab.value = decode(window.localStorage.getItem(PZ_HOME_STORAGE_KEY)).tab
    } catch {
      tab.value = 'uci'
    }
  }

  function persist(next: PzHomeTab) {
    if (!import.meta.client) return
    load()
    try {
      window.localStorage.setItem(PZ_HOME_STORAGE_KEY, JSON.stringify({ version: 1, tab: next } satisfies PzHomeState))
    } catch {
      // storage failures never interrupt browsing
    }
  }

  onMounted(load)

  watch(tab, persist)

  return { tab, loaded: readonly(loaded) }
}
