<script setup lang="ts">
import { computed } from 'vue'
import type { TabsItem } from '@nuxt/ui'
import { pzRoutes } from '~~/shared/utils/appRoutes'

const { t } = useI18n()
const localePath = useLocalePath()
const { tab } = usePzHome()
const { pool } = useCardPool()

const items: TabsItem[] = [
  { label: t('pz.home.switch.learnTab'), icon: 'i-lucide-graduation-cap', value: 'uci', slot: 'uci' as const },
  { label: t('pz.home.switch.playTab'), icon: 'i-lucide-gamepad-2', value: 'igraj', slot: 'igraj' as const }
]

// Three games, not a wall of tiles: the quiz, a friend challenge and the flip cards. "Riječ dana" has its own plate
// higher up the page.
const playGames = computed(() => [
  { title: t('pz.home.switch.tileQuiz'), icon: 'i-lucide-help-circle', to: localePath(pzRoutes.quiz), minutes: 2 },
  { title: t('pz.home.switch.tileChallenge'), icon: 'i-lucide-swords', to: localePath(pzRoutes.challenge), minutes: 2 },
  { title: t('pz.home.switch.tileCards'), icon: 'i-lucide-layers', to: localePath(pzRoutes.learn), minutes: 10 }
])

// A full-width pill switch, 48px tall: the active segment is paper with an accented edge on a muted track. It only
// swaps the panel under it; it is not page navigation.
const ui = {
  root: 'gap-0',
  list: 'rounded-full border border-accented bg-muted p-1',
  indicator: 'rounded-full border border-accented bg-default shadow-none',
  trigger: 'pz-label min-h-10 rounded-full px-4 text-muted data-[state=active]:text-default',
  leadingIcon: 'size-[18px]'
}
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
      variant="pill"
      :unmount-on-hide="false"
      :ui="ui"
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
          class="flex flex-col gap-3 pt-4"
          data-testid="learn-play-panel-igraj"
        >
          <div class="grid gap-3 sm:grid-cols-3">
            <PzGameCard
              v-for="game in playGames"
              :key="game.title"
              :title="game.title"
              :to="game.to"
              :icon="game.icon"
              :minutes="game.minutes"
            />
          </div>
          <ULink
            :to="localePath(pzRoutes.games)"
            class="pz-label inline-flex min-h-(--pz-tap-min) items-center gap-1 self-start text-primary hover:underline"
          >
            {{ t('pz.home.switch.allGames') }}
          </ULink>
        </div>
      </template>
    </UTabs>
  </section>
</template>
