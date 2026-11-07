<script setup lang="ts">
import { pzTabForPath, pzTabs } from '~~/shared/utils/pzNav'

// The four-tab mobile bar. Only this bar marks the current section. It is fixed to the bottom below
// 1024px and gone above it; `usePzTabBar` hides it during a round, a challenge, a sheet or typing.
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const { hidden, hold, release } = usePzTabBar()

const active = computed(() => pzTabForPath(route.path))
const labels = { home: 'pz.nav.home', games: 'pz.nav.games', explore: 'pz.nav.explore', contribute: 'pz.nav.contribute' } as const

// The on-screen keyboard covers the bar's place, so hide it while a text field has focus.
const TEXT_FIELD = 'textarea, select, input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="range"], [type="file"], [type="color"], [type="reset"], [type="image"])'
let blurTimer: ReturnType<typeof setTimeout> | undefined

function onFocusIn(event: FocusEvent) {
  if (!(event.target instanceof Element) || !event.target.matches(TEXT_FIELD)) return
  clearTimeout(blurTimer)
  hold('keyboard')
}
function onFocusOut() {
  clearTimeout(blurTimer)
  blurTimer = setTimeout(() => release('keyboard'), 100)
}

onMounted(() => {
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
})
onBeforeUnmount(() => {
  document.removeEventListener('focusin', onFocusIn)
  document.removeEventListener('focusout', onFocusOut)
  clearTimeout(blurTimer)
  release('keyboard')
})
</script>

<template>
  <nav
    v-if="!hidden"
    :aria-label="t('pz.nav.main')"
    class="fixed inset-x-0 bottom-0 z-40 grid h-[calc(var(--pz-tabbar-h)+env(safe-area-inset-bottom))] grid-cols-4 border-t border-accented bg-default pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
    data-testid="pz-bottom-nav"
  >
    <NuxtLink
      v-for="tab in pzTabs"
      :key="tab.key"
      :to="localePath(tab.to)"
      :aria-current="active === tab.key ? 'page' : undefined"
      :data-tab="tab.key"
      class="group flex min-w-0 flex-col items-center justify-center gap-0.5 pz-caption text-muted aria-[current=page]:font-semibold aria-[current=page]:text-default"
    >
      <span class="grid h-[30px] w-14 place-items-center rounded-full group-aria-[current=page]:bg-accented group-aria-[current=page]:text-primary forced-colors:group-aria-[current=page]:border forced-colors:group-aria-[current=page]:border-[CanvasText]">
        <UIcon
          :name="tab.icon"
          class="size-[22px]"
          aria-hidden="true"
        />
      </span>
      <span class="truncate">{{ t(labels[tab.key]) }}</span>
    </NuxtLink>
  </nav>
</template>
