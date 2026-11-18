<script setup lang="ts">
import { pzSectionGroups, pzCurrentSection } from '~~/shared/utils/pzNav'

const route = useRoute()
const localePath = useLocalePath()
const group = computed(() => pzSectionGroups.find(item => route.path.startsWith(item.to.replace(/\/$/, ''))))
const active = computed(() => pzCurrentSection(route.path))
</script>

<template>
  <nav
    v-if="group"
    class="sticky top-0 z-40 border-b border-default bg-default shadow-sm md:top-0 lg:hidden"
    aria-label="Odjeljci"
  >
    <UContainer class="flex min-h-14 items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <NuxtLink
        v-for="item in group.items"
        :key="item.to"
        :to="localePath(item.to)"
        :aria-current="active === item.to ? 'page' : undefined"
        class="min-h-(--pz-tap-min) shrink-0 rounded-full px-3 py-2 text-sm font-semibold text-muted hover:bg-elevated aria-[current=page]:bg-primary aria-[current=page]:text-inverted"
      >{{ item.label }}</NuxtLink>
    </UContainer>
  </nav>
</template>
