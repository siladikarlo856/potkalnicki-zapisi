<script setup lang="ts">
import { GAME_TYPE_LABELS, gameTypeOf } from '~~/shared/utils/games/catalogue'
import type { GameEntry, GameFormat } from '~~/shared/utils/games/catalogue'

// GameCard: choose a game. One link: icon tile, name, one sentence, then the question type and how you did before
// ("Najbolje: 8/10", "Još nije igrano"). A game that is not playable yet says "Uskoro" and links to where the
// reader can help (`soonHref`), so a card is never greyed out without a reason.
const props = defineProps<{ game: GameEntry, soonHref?: string }>()

const localePath = useLocalePath()
const NuxtLink = resolveComponent('NuxtLink')
const { scores } = useGameScores()

const icons: Record<GameFormat, string> = {
  'dnevna': 'i-lucide-calendar-days',
  'odabir': 'i-lucide-list-checks',
  'karta': 'i-lucide-map',
  'upisi': 'i-lucide-keyboard',
  'spoji': 'i-lucide-link',
  'razvrstaj': 'i-lucide-columns-3',
  'grupiraj': 'i-lucide-grid-2x2',
  'bez-greske': 'i-lucide-heart'
}

const soon = computed(() => props.game.status === 'soon')
const status = computed(() => {
  if (soon.value) return 'Uskoro'
  const best = scores.value.best[props.game.id]
  if (!best) return 'Još nije igrano'
  return `Najbolje: ${props.game.id === 'bez-greske' ? best.score : `${best.score}/${best.max}`}`
})
const to = computed(() => {
  if (soon.value) return props.soonHref ? localePath(props.soonHref) : undefined
  const [base = '', hash] = props.game.path.split('#')
  return hash === undefined ? localePath(base) : `${localePath(base)}#${hash}`
})
</script>

<template>
  <component
    :is="to ? NuxtLink : 'div'"
    :to="to"
    :data-testid="`game-tile-${game.id}`"
    class="group flex h-full min-w-0 gap-4 rounded-(--pz-radius-lg) border border-default bg-default p-4 no-underline hover:border-accented"
  >
    <span
      class="grid size-12 shrink-0 place-items-center rounded-(--pz-radius-md) bg-(--pz-primary-soft) text-primary"
      aria-hidden="true"
    >
      <UIcon
        :name="icons[game.format]"
        class="size-6"
      />
    </span>
    <span class="flex min-w-0 flex-col gap-1">
      <span class="pz-h3 wrap-anywhere text-highlighted group-hover:underline">{{ game.title }}</span>
      <span class="pz-body-sm text-muted">{{ game.blurb }}</span>
      <span class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <PzKindTag>{{ GAME_TYPE_LABELS[gameTypeOf(game)!] }}</PzKindTag>
        <span
          class="pz-body-sm font-semibold text-default tabular-nums"
          data-testid="game-card-status"
        >{{ status }}</span>
      </span>
    </span>
  </component>
</template>
