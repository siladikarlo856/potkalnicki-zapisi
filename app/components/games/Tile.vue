<script setup lang="ts">
import type { GameEntry } from '~~/shared/utils/games/catalogue'

const props = defineProps<{
  game: GameEntry
  soonHref?: string
  soonLabel?: string
}>()

const { t } = useI18n()
const localePath = useLocalePath()

const formatIcon: Record<GameEntry['format'], string> = {
  'dnevna': 'i-lucide-calendar-days',
  'odabir': 'i-lucide-list-checks',
  'karta': 'i-lucide-map',
  'upisi': 'i-lucide-keyboard',
  'spoji': 'i-lucide-link',
  'razvrstaj': 'i-lucide-columns-3',
  'grupiraj': 'i-lucide-grid-2x2',
  'bez-greske': 'i-lucide-heart'
}

const { scores } = useGameScores()
// Best results are written by the game shell as `pz-games/v1` (WP7); the composable loads them on mount.
const bestScore = computed(() => {
  const best = scores.value.best[props.game.id]
  return best ? `${best.score}/${best.max}` : null
})

const linkTo = computed(() => {
  if (props.game.status === 'soon' && props.soonHref) return localePath(props.soonHref)
  const path = props.game.path
  if (path.startsWith('#')) return path
  const hashIndex = path.indexOf('#')
  if (hashIndex !== -1) {
    const base = path.slice(0, hashIndex)
    const hash = path.slice(hashIndex + 1)
    return `${localePath(base)}#${hash}`
  }
  return localePath(path)
})
</script>

<template>
  <NuxtLink
    v-if="game.status === 'live'"
    :to="linkTo"
    :data-testid="`game-tile-${game.id}`"
    class="block h-full rounded-lg transition hover:ring-1 hover:ring-primary/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
  >
    <UCard
      class="h-full"
      variant="outline"
    >
      <div class="flex h-full flex-col gap-3">
        <div class="flex items-start justify-between gap-2">
          <UIcon
            :name="formatIcon[game.format]"
            class="size-7 shrink-0 text-primary"
          />
        </div>
        <div class="space-y-1">
          <h3 class="text-lg font-semibold text-highlighted">
            {{ game.title }}
          </h3>
          <p class="text-sm text-muted">
            {{ game.blurb }}
          </p>
        </div>
        <div class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span>{{ t('pz.play.minutes', { n: game.minutes }) }}</span>
          <span
            v-if="bestScore !== null"
            class="text-highlighted"
          >
            {{ t('pz.play.best', { score: bestScore }) }}
          </span>
        </div>
      </div>
    </UCard>
  </NuxtLink>
  <UCard
    v-else
    :data-testid="`game-tile-${game.id}`"
    class="h-full opacity-70"
    variant="outline"
  >
    <div class="flex h-full flex-col gap-3">
      <div class="flex items-start justify-between gap-2">
        <UIcon
          :name="formatIcon[game.format]"
          class="size-7 shrink-0 text-primary"
        />
        <UBadge
          v-if="game.status === 'soon'"
          :label="t('pz.home.soon')"
          color="neutral"
          variant="subtle"
        />
      </div>
      <div class="space-y-1">
        <h3 class="text-lg font-semibold text-highlighted">
          {{ game.title }}
        </h3>
        <p class="text-sm text-muted">
          {{ game.blurb }}
        </p>
      </div>
      <div class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span>{{ t('pz.play.minutes', { n: game.minutes }) }}</span>
        <span
          v-if="bestScore !== null"
          class="text-highlighted"
        >
          {{ t('pz.play.best', { score: bestScore }) }}
        </span>
      </div>
      <UButton
        v-if="soonHref"
        :to="localePath(soonHref)"
        :label="soonLabel ?? t('pz.play.tellUs')"
        color="neutral"
        variant="soft"
        size="sm"
        class="w-fit"
      />
    </div>
  </UCard>
</template>
