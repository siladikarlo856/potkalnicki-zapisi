import { getCurrentInstance, useId, type MaybeRefOrGetter } from 'vue'

/**
 * Why the mobile tab bar is hidden. Pages and components hold the bar down for as long as one of
 * these is true; the bar returns once every hold is released.
 *
 * - `game`: a game round is in play (set by `games/Shell.vue`).
 * - `challenge`: the challenge flow after "Kreni" (set by `heritage/ChallengeExperience.vue`).
 * - `sheet`: a bottom sheet is open. `PzBottomSheet` calls
 *   `useHidePzTabBar(open, 'sheet')` with its open state.
 * - `keyboard`: the on-screen keyboard is up (set by `PzBottomNav`).
 *
 * Dropping the site header and footer is separate: `RoundBar` sets the `pz-round-shell-active` state
 * while it is rendered, and the layout reads it.
 */
export type PzTabBarHold = 'game' | 'challenge' | 'sheet' | 'keyboard'

export function usePzTabBar() {
  const owners = useState<Record<string, PzTabBarHold[]>>('pz-tabbar-owners', () => ({}))
  const owner = getCurrentInstance() ? useId() : crypto.randomUUID()
  const holds = computed(() => [...new Set(Object.values(owners.value).flat())])
  const hidden = computed(() => holds.value.length > 0)

  function hold(reason: PzTabBarHold) {
    const held = owners.value[owner] ?? []
    if (!held.includes(reason)) owners.value[owner] = [...held, reason]
  }
  function release(reason: PzTabBarHold) {
    const held = owners.value[owner]?.filter(item => item !== reason)
    if (!held) return
    if (held.length) owners.value[owner] = held
    else delete owners.value[owner]
  }

  return { holds, hidden, hold, release }
}

/** Hide the tab bar while `active` is true, and release the hold when the caller goes away. */
export function useHidePzTabBar(active: MaybeRefOrGetter<boolean>, reason: PzTabBarHold) {
  const { hold, release } = usePzTabBar()
  watch(() => toValue(active), value => value ? hold(reason) : release(reason), { immediate: true })
  onScopeDispose(() => release(reason))
}
