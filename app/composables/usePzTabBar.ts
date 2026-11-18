import type { MaybeRefOrGetter } from 'vue'

/**
 * Why the mobile tab bar is hidden. Pages and components hold the bar down for as long as one of
 * these is true; the bar returns once every hold is released.
 *
 * - `game`: a game round is in play (set by `games/Shell.vue`).
 * - `challenge`: the challenge flow after "Kreni" (set by `heritage/ChallengeExperience.vue`).
 * - `sheet`: a bottom sheet is open. `PzBottomSheet` calls
 *   `useHidePzTabBar(open, 'sheet')` with its open state.
 * - `keyboard`: the on-screen keyboard is up (set by `PzBottomNav`).
 */
export type PzTabBarHold = 'game' | 'challenge' | 'round' | 'sheet' | 'keyboard'

export function usePzTabBar() {
  const holds = useState<PzTabBarHold[]>('pz-tabbar-holds', () => [])
  const hidden = computed(() => holds.value.length > 0)

  function hold(reason: PzTabBarHold) {
    if (!holds.value.includes(reason)) holds.value = [...holds.value, reason]
  }
  function release(reason: PzTabBarHold) {
    if (holds.value.includes(reason)) holds.value = holds.value.filter(item => item !== reason)
  }

  return { holds, hidden, hold, release }
}

/** Hide the tab bar while `active` is true, and release the hold when the caller goes away. */
export function useHidePzTabBar(active: MaybeRefOrGetter<boolean>, reason: PzTabBarHold) {
  const { hold, release } = usePzTabBar()
  watch(() => toValue(active), value => value ? hold(reason) : release(reason), { immediate: true })
  onScopeDispose(() => release(reason))
}
