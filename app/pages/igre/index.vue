<script setup lang="ts">
import {
  GAME_GROUPS,
  GAME_TYPE_LABELS,
  gameGroupOf,
  gameTypeOf,
  isListedGame,
  soonGames,
  visibleGames
} from '~~/shared/utils/games/catalogue'
import { countNoun } from '~/utils/pzText'
import type { GameType } from '~~/shared/utils/games/catalogue'
import { pzPath, pzRoutes } from '~~/shared/utils/appRoutes'

// /igre/: every game, grouped by what it trains, with chips by question type. The daily word and the learning
// cards have their own screens; challenges are reached from a game's start page and from /izazov/.
definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const GAMES_DESCRIPTION = 'Trinaest kratkih igara o riječima, mjestima, baštini i ljudima ovoga kraja.'
const route = useRoute()
const router = useRouter()
const { pool, status, error, refresh } = useCardPool()

const loading = computed(() => !error.value && (status.value === 'idle' || status.value === 'pending'))

// Old topic addresses (?tema=rijeci) still narrow the list; the chips filter by question type (?vrsta=).
const legacyTopic = computed(() => typeof route.query.tema === 'string' ? route.query.tema : undefined)
const type = computed<GameType | undefined>(() => {
  const value = route.query.vrsta
  return typeof value === 'string' && value in GAME_TYPE_LABELS ? value as GameType : undefined
})

const playable = computed(() => visibleGames(pool.value, legacyTopic.value).filter(isListedGame))
const filtered = computed(() => type.value ? playable.value.filter(game => gameTypeOf(game) === type.value) : playable.value)
const typeChips = computed(() => (Object.keys(GAME_TYPE_LABELS) as GameType[])
  .map(id => ({ id, label: GAME_TYPE_LABELS[id], count: playable.value.filter(game => gameTypeOf(game) === id).length }))
  .filter(chip => chip.count > 0))
const groups = computed(() => GAME_GROUPS
  .map(group => ({ ...group, games: filtered.value.filter(game => gameGroupOf(game) === group.id) }))
  .filter(group => group.games.length > 0))
const soon = computed(() => type.value ? [] : soonGames())
const soonHref = `${pzRoutes.contribute}?vrsta=sjecanje`

function choose(next: GameType | undefined) {
  const query = { ...route.query }
  if (next && next !== type.value) query.vrsta = next
  else delete query.vrsta
  void router.replace({ query })
}

useSeoMeta({
  title: 'Igre',
  ogTitle: 'Igre · Potkalnički zapisi',
  ogDescription: GAMES_DESCRIPTION,
  description: GAMES_DESCRIPTION
})
</script>

<template>
  <UContainer class="py-6 sm:py-10">
    <PageHead
      title="Igre"
      :lead="`${GAMES_DESCRIPTION} Svaka traje nekoliko minuta.`"
    />

    <Skeleton
      v-if="loading"
      :lines="6"
      block
      label="Učitavanje igara…"
      data-testid="play-loading"
    />

    <PageState
      v-else-if="error"
      kind="error"
      title="Popis igara nismo uspjeli učitati"
      @retry="refresh()"
    />

    <PageState
      v-else-if="!playable.length"
      kind="empty"
      title="Igre se još pripremaju"
      description="Za igre treba dovoljno provjerenih zapisa. Dotad možeš učiti riječi ili pogoditi riječ dana."
      data-testid="play-empty-state"
    >
      <template #actions>
        <UButton
          :to="pzRoutes.learn"
          label="Uči riječi"
        />
        <UButton
          :to="pzPath('rijec-dana')"
          label="Riječ dana"
          color="neutral"
          variant="outline"
        />
      </template>
    </PageState>

    <div
      v-else
      class="flex flex-col gap-8"
      data-testid="play-catalog"
    >
      <div
        class="flex flex-wrap gap-2"
        role="group"
        aria-label="Vrsta pitanja"
        data-testid="play-topic-filters"
      >
        <PzChip
          v-for="chip in typeChips"
          :key="chip.id"
          :selected="type === chip.id"
          :count="chip.count"
          :data-testid="`play-filter-${chip.id}`"
          @click="choose(chip.id)"
        >
          {{ chip.label }}
        </PzChip>
      </div>
      <p
        v-if="type"
        role="status"
        class="pz-body-sm -mt-4 text-muted"
        data-testid="play-filter-count"
      >
        {{ countNoun(filtered.length, 'igra', 'igre') }}
      </p>

      <section
        v-for="group in groups"
        :key="group.id"
        :aria-labelledby="`play-group-${group.id}`"
        :data-testid="`play-group-${group.id}`"
      >
        <h2
          :id="`play-group-${group.id}`"
          class="pz-h2 mb-3 text-highlighted"
        >
          {{ group.label }}
        </h2>
        <div class="grid gap-3 lg:grid-cols-3 md:grid-cols-2">
          <GamesGameCard
            v-for="game in group.games"
            :key="game.id"
            :game="game"
          />
        </div>
      </section>

      <section
        v-if="soon.length"
        aria-labelledby="play-soon-heading"
      >
        <h2
          id="play-soon-heading"
          class="pz-h2 mb-3 text-highlighted"
        >
          Uskoro
        </h2>
        <div
          class="grid gap-3 lg:grid-cols-3 md:grid-cols-2"
          data-testid="play-soon-grid"
        >
          <GamesGameCard
            v-for="game in soon"
            :key="game.id"
            :game="game"
            :soon-href="soonHref"
          />
        </div>
      </section>
    </div>
  </UContainer>
</template>
