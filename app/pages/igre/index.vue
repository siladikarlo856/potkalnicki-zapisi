<script setup lang="ts">
import {
  liveTopicsInCatalogue,
  soonGames,
  visibleGames
} from '~~/shared/utils/games/catalogue'
import { challengeListGroup } from '~~/shared/utils/challengeList'
import { pzRoutes } from '~~/shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()

const { pool } = useCardPool()
const { items, refreshItem, resetRefreshBudget, newPlayersFor } = useChallengeList()

const stripItems = computed(() =>
  items.value.filter(item => challengeListGroup(item) !== 'finished').slice(0, 3)
)

onMounted(() => {
  resetRefreshBudget()
  for (const item of stripItems.value) {
    void refreshItem(item.code, { fetchLeaderboard: item.role === 'creator' })
  }
})

const filterApplied = ref(false)
const selectedTopic = ref<string | undefined>(undefined)

const baseFilterTopics = [
  { id: 'sve', labelKey: 'pz.play.filterAll' },
  { id: 'rijeci', label: 'Riječi' },
  { id: 'mjesta', label: 'Mjesta' },
  { id: 'bastina', label: 'Baština' }
] as const

const extraFilterTopics = computed(() => {
  const baseIds = new Set(['rijeci', 'mjesta', 'bastina'])
  const labels: Record<string, string> = {
    osobe: 'Osobe',
    legende: 'Legende i priče',
    mjesovito: 'Mješovito'
  }
  return liveTopicsInCatalogue()
    .filter(id => !baseIds.has(id))
    .map(id => ({ id, label: labels[id] ?? id }))
})

onMounted(() => {
  const tema = route.query.tema
  if (typeof tema === 'string' && tema.length > 0) {
    selectedTopic.value = tema
    filterApplied.value = true
  }
})

function selectTopic(id: string) {
  const next = id === 'sve' ? undefined : id
  selectedTopic.value = next
  filterApplied.value = true
  const query = { ...route.query }
  if (next) query.tema = next
  else delete query.tema
  router.replace({ query })
}

const activeTopic = computed(() => (filterApplied.value ? selectedTopic.value : undefined))

const liveGames = computed(() => visibleGames(pool.value, activeTopic.value))

const soonEntries = soonGames()

const memoryHref = `${pzRoutes.contribute}?vrsta=sjecanje`

const emptyTopicMessages: Record<string, { textKey: string, linkKey: string, href: string }> = {
  mjesta: {
    textKey: 'pz.play.emptyMjesta',
    linkKey: 'pz.play.emptyMjestaLink',
    href: pzRoutes.games
  },
  bastina: {
    textKey: 'pz.play.emptyBastina',
    linkKey: 'pz.play.emptyBastinaLink',
    href: pzRoutes.games
  }
}

const emptyState = computed(() => {
  const topic = activeTopic.value
  if (!topic || liveGames.value.length > 0) return null
  return emptyTopicMessages[topic] ?? {
    textKey: 'pz.play.emptyGeneric',
    linkKey: 'pz.play.emptyGenericLink',
    href: pzRoutes.games
  }
})

useSeoMeta({
  title: () => t('pz.play.title'),
  ogTitle: () => `${t('pz.play.title')} · Potkalnički zapisi`,
  ogDescription: () => t('pz.games.hubDescription'),
  description: () => t('pz.games.hubDescription')
})
</script>

<template>
  <UContainer class="py-10 sm:py-14">
    <div class="mx-auto max-w-4xl space-y-10">
      <header>
        <h1 class="text-3xl font-bold text-highlighted sm:text-4xl">
          {{ t('pz.play.title') }}
        </h1>
        <p class="mt-2 max-w-2xl text-muted">
          {{ t('pz.games.hubDescription') }}
        </p>
      </header>

      <section
        id="rijec-dana"
        class="rounded-(--pz-radius-lg) border border-default p-4 sm:p-5"
        aria-labelledby="igre-rijec-dana"
        data-testid="igre-daily-link"
      >
        <h2
          id="igre-rijec-dana"
          class="pz-h3 text-highlighted"
        >
          Riječ dana
        </h2>
        <p class="mt-1 text-muted">
          Jedna riječ domaćega govora na dan, pogodi je iz tragova.
        </p>
        <UButton
          class="mt-3"
          :to="localePath(pzRoutes.daily)"
          label="Igraj riječ dana"
          icon="i-lucide-arrow-right"
          trailing
          color="neutral"
          variant="outline"
        />
      </section>

      <HeritageChallengeActiveStrip
        v-if="stripItems.length"
        :items="stripItems"
        :new-players-for="newPlayersFor"
      />

      <section
        data-testid="play-catalog"
        aria-labelledby="play-games-heading"
      >
        <h2
          id="play-games-heading"
          class="sr-only"
        >
          {{ t('pz.play.title') }}
        </h2>

        <div
          class="mb-6 flex flex-wrap gap-2"
          data-testid="play-topic-filters"
          role="tablist"
        >
          <UButton
            v-for="chip in baseFilterTopics"
            :key="chip.id"
            :data-testid="`play-filter-${chip.id}`"
            :label="'labelKey' in chip ? t(chip.labelKey) : chip.label"
            :color="(activeTopic ?? 'sve') === chip.id || (chip.id === 'sve' && !activeTopic) ? 'primary' : 'neutral'"
            :variant="(activeTopic ?? 'sve') === chip.id || (chip.id === 'sve' && !activeTopic) ? 'solid' : 'outline'"
            size="sm"
            role="tab"
            @click="selectTopic(chip.id)"
          />
          <UButton
            v-for="chip in extraFilterTopics"
            :key="chip.id"
            :data-testid="`play-filter-${chip.id}`"
            :label="chip.label"
            :color="activeTopic === chip.id ? 'primary' : 'neutral'"
            :variant="activeTopic === chip.id ? 'solid' : 'outline'"
            size="sm"
            role="tab"
            @click="selectTopic(chip.id)"
          />
        </div>

        <div
          v-if="emptyState"
          class="rounded-lg border border-dashed border-default p-8 text-center"
          data-testid="play-empty-state"
        >
          <p class="text-muted">
            {{ t(emptyState.textKey) }}
          </p>
          <UButton
            :to="localePath(emptyState.href)"
            :label="t(emptyState.linkKey)"
            class="mt-4"
            variant="link"
          />
        </div>

        <div
          v-else
          class="grid gap-4 sm:grid-cols-2"
          data-testid="play-game-grid"
        >
          <GamesTile
            v-for="game in liveGames"
            :key="game.id"
            :game="game"
          />
        </div>
      </section>

      <PzChallengeCard
        :overline="t('challenge.friendTitle')"
        :title="t('pz.games.friendHeroTitle')"
        :text="t('pz.games.friendHeroDescription')"
        :cta="t('pz.games.friendHeroCta')"
        :to="localePath(pzRoutes.challenge)"
        data-testid="friend-challenge-card"
      />

      <section
        v-if="soonEntries.length"
        aria-labelledby="play-soon-heading"
      >
        <h2
          id="play-soon-heading"
          class="mb-4 text-xl font-semibold text-highlighted"
        >
          {{ t('pz.play.soon') }}
        </h2>
        <div
          class="grid gap-4 sm:grid-cols-2"
          data-testid="play-soon-grid"
        >
          <GamesTile
            v-for="game in soonEntries"
            :key="game.id"
            :game="game"
            :soon-href="memoryHref"
            :soon-label="t('pz.play.tellUs')"
          />
        </div>
      </section>
    </div>
  </UContainer>
</template>
