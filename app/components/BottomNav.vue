<script setup lang="ts">
import { pzBottomNavItems, pzBottomNavForPath } from '~~/shared/utils/pzNav'

const route = useRoute()
const localePath = useLocalePath()
const { hidden } = usePzTabBar()
const { hold, release } = usePzTabBar()
const active = computed(() => pzBottomNavForPath(route.path))

const textField = 'textarea, select, input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="range"], [type="file"], [type="color"], [type="reset"], [type="image"])'
let blurTimer: ReturnType<typeof setTimeout> | undefined

function onFocusIn(event: FocusEvent) {
  if (event.target instanceof Element && event.target.matches(textField)) {
    clearTimeout(blurTimer)
    hold('keyboard')
  }
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
    class="fixed inset-x-0 bottom-0 z-40 grid h-[calc(var(--pz-size-bottom-bar)+env(safe-area-inset-bottom))] grid-cols-5 border-t border-default bg-default pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
    aria-label="Glavna navigacija"
    data-testid="bottom-nav"
  >
    <NuxtLink
      v-for="item in pzBottomNavItems"
      :key="item.key"
      :to="localePath(item.to)"
      :aria-current="active === item.key ? 'page' : undefined"
      class="group flex min-w-0 flex-col items-center justify-center gap-0.5 pz-caption text-muted aria-[current=page]:font-bold aria-[current=page]:text-default"
    >
      <span class="grid h-[30px] w-14 place-items-center rounded-full group-aria-[current=page]:bg-(--pz-primary-soft) group-aria-[current=page]:text-primary"><UIcon
        :name="item.icon"
        class="size-[22px]"
        aria-hidden="true"
      /></span>
      <span class="truncate">{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>
