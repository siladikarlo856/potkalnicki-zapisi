<script setup lang="ts">
import { pzBottomNavItems, pzBottomNavForPath } from '~~/shared/utils/pzNav'

const route = useRoute()
const localePath = useLocalePath()
const { hidden } = usePzTabBar()
const active = computed(() => pzBottomNavForPath(route.path))
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
