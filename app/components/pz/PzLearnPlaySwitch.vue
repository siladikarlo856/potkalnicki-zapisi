<script setup lang="ts">
import { computed } from 'vue'
import type { TabsItem } from '@nuxt/ui'
import { pzRoutes } from '~~/shared/utils/appRoutes'

const { t } = useI18n()
const localePath = useLocalePath()
const { tab } = usePzHome()
const { pool } = useCardPool()

const items: TabsItem[] = [
  { label: t('pz.home.switch.learnTab'), value: 'uci', slot: 'uci' as const },
  { label: t('pz.home.switch.playTab'), value: 'igraj', slot: 'igraj' as const }
]

const playTiles = computed(() => [
  { title: t('pz.home.switch.tileDaily'), icon: 'i-lucide-sparkles', to: '#rijec-dana', minutes: 2 },
  { title: t('pz.home.switch.tileQuiz'), icon: 'i-lucide-help-circle', to: localePath(pzRoutes.quiz), minutes: 2 },
  { title: t('pz.home.switch.tileChallenge'), icon: 'i-lucide-swords', to: localePath(pzRoutes.challenge), minutes: 2 },
  { title: t('pz.home.switch.tileCards'), icon: 'i-lucide-layers', to: localePath(pzRoutes.learn), minutes: 10 }
])
</script>

<template>
  <section
    class="w-full"
    data-testid="learn-play-switch"
  >
    <UTabs
      v-model="tab"
      :items="items"
      value-key="value"
      :unmount-on-hide="false"
      class="w-full"
    >
      <template #uci>
        <div
          class="pt-4"
          data-testid="learn-play-panel-uci"
        >
          <LearnHomePanel :pool="pool" />
        </div>
      </template>

      <template #igraj>
        <div
          class="space-y-4 pt-4"
          data-testid="learn-play-panel-igraj"
        >
          <div class="grid grid-cols-2 gap-3">
            <ULink
              v-for="tile in playTiles"
              :key="tile.title"
              :to="tile.to"
              class="flex flex-col gap-2 rounded-lg bg-elevated p-3 ring ring-default transition hover:ring-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <UIcon
                :name="tile.icon"
                class="size-5 text-primary"
              />
              <span class="font-medium text-highlighted">{{ tile.title }}</span>
              <span class="text-xs text-muted">{{ t('pz.home.switch.minutes', { n: tile.minutes }) }}</span>
            </ULink>
          </div>
          <ULink
            :to="localePath(pzRoutes.games)"
            class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {{ t('pz.home.switch.allGames') }}
            <UIcon
              name="i-lucide-arrow-right"
              class="size-4"
            />
          </ULink>
        </div>
      </template>
    </UTabs>
  </section>
</template>
