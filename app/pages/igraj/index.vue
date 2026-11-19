<script setup lang="ts">
import { pzPath, pzRoutes } from '~~/shared/utils/appRoutes'

// Igraj i uči: the destination of "Igraj" in the bottom bar. Today's word, learning, three games and challenges in
// one place. Phone: one column in that order. Desktop: two rows of two (daily 5 + learning 7, games 7 + challenges 5).
definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const localePath = useLocalePath()

useSeoMeta({
  title: 'Igraj i uči',
  ogTitle: 'Igraj i uči · Potkalnički zapisi',
  description: 'Jedna riječ na dan, kartice za učenje, trinaest igara i izazovi s prijateljima.',
  ogDescription: 'Jedna riječ na dan, kartice za učenje, trinaest igara i izazovi s prijateljima.'
})

const { cards, dueCount, learnedCount } = useProgress()
const learn = useLearnState()
const { homeHighlight, resetRefreshBudget, refreshItem, items, newPlayersFor, totalCount } = useChallengeList()

const ready = ref(false)
const code = ref('')
const codeError = ref('')

const stored = computed(() => ready.value ? Object.keys(cards.value).length : 0)
const due = computed(() => ready.value ? dueCount() : 0)
const known = computed(() => ready.value ? learnedCount() : 0)
const returning = computed(() => stored.value > 0 || !!learn.current.value)
const reviewHref = computed(() => localePath(due.value > 0 ? `${pzRoutes.learnSession}?ponovi=1` : pzRoutes.learn))

const games = [
  { title: 'Kviz riječi', blurb: 'Što znači domaća riječ?', icon: 'i-lucide-circle-help', to: pzRoutes.quiz },
  { title: 'Gdje je naselje?', blurb: 'Pokaži selo na karti.', icon: 'i-lucide-map-pinned', to: pzRoutes.mapFind },
  { title: 'Što je gdje?', blurb: 'Baština i njezino naselje.', icon: 'i-lucide-link-2', to: pzRoutes.heritageMatch }
]

function openCode() {
  const value = code.value.trim()
  if (!/^[A-Za-z0-9_-]{16,32}$/.test(value)) {
    codeError.value = 'Kôd ima barem 16 znakova: slova, brojke, - ili _.'
    return
  }
  codeError.value = ''
  navigateTo(localePath(pzPath(pzRoutes.challenge, value)))
}

onMounted(async () => {
  learn.load()
  ready.value = true
  resetRefreshBudget()
  for (const item of items.value.slice(0, 3)) await refreshItem(item.code, { fetchLeaderboard: item.role === 'creator' })
})
</script>

<template>
  <UContainer class="py-4 lg:py-6">
    <PageHead
      title="Igraj i uči"
      lead="Jedna riječ na dan, kartice za učenje, trinaest igara i izazovi s prijateljima."
    />
    <div
      class="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6 [&>*]:min-w-0"
      data-testid="play-hub"
    >
      <div
        class="lg:col-span-5"
        data-testid="hub-daily"
      >
        <DailyWordCard />
      </div>

      <section
        class="flex flex-col gap-3 rounded-(--pz-radius-lg) border border-default bg-default p-4 sm:p-5 lg:col-span-7"
        aria-labelledby="hub-learn"
        data-testid="hub-learn"
      >
        <div class="flex items-baseline justify-between gap-3">
          <h2
            id="hub-learn"
            class="pz-h2 text-highlighted"
          >
            Uči
          </h2>
          <NuxtLink
            :to="localePath(pzRoutes.learn)"
            class="inline-flex min-h-(--pz-tap-min) items-center text-sm font-semibold text-primary hover:underline"
          >
            Otvori
          </NuxtLink>
        </div>
        <template v-if="returning">
          <p class="text-muted">
            {{ due }} {{ due === 1 ? 'riječ čeka' : 'riječi čeka' }} ponavljanje. Znaš {{ known }} {{ known === 1 ? 'riječ' : 'riječi' }}.
          </p>
          <UProgress
            :model-value="known"
            :max="Math.max(stored, 1)"
            aria-label="Naučene riječi"
          />
          <UButton
            :to="reviewHref"
            label="Nastavi učiti"
            icon="i-lucide-play"
            size="lg"
            block
            data-testid="hub-learn-continue"
          />
        </template>
        <template v-else>
          <p class="text-muted">
            Kartice s riječima domaćega govora. Pet minuta na dan dovoljno je.
          </p>
          <UButton
            :to="localePath(pzRoutes.learn)"
            label="Odaberi prve riječi"
            icon="i-lucide-graduation-cap"
            color="neutral"
            variant="outline"
            size="lg"
            block
            data-testid="hub-learn-first"
          />
        </template>
      </section>

      <section
        class="flex flex-col gap-3 lg:col-span-7"
        aria-labelledby="hub-games"
        data-testid="hub-games"
      >
        <div class="flex items-baseline justify-between gap-3">
          <h2
            id="hub-games"
            class="pz-h2 text-highlighted"
          >
            Igre
          </h2>
          <NuxtLink
            :to="localePath(pzRoutes.games)"
            class="inline-flex min-h-(--pz-tap-min) items-center text-sm font-semibold text-primary hover:underline"
          >
            Svih 13
          </NuxtLink>
        </div>
        <div class="grid gap-3 sm:grid-cols-3">
          <PzGameCard
            v-for="game in games"
            :key="game.title"
            :title="game.title"
            :blurb="game.blurb"
            :icon="game.icon"
            :to="localePath(game.to)"
          />
        </div>
      </section>

      <section
        class="flex flex-col gap-3 rounded-(--pz-radius-lg) border border-default bg-default p-4 sm:p-5 lg:col-span-5"
        aria-labelledby="hub-challenges"
        data-testid="hub-challenges"
      >
        <div class="flex items-baseline justify-between gap-3">
          <h2
            id="hub-challenges"
            class="pz-h2 text-highlighted"
          >
            Izazovi
          </h2>
          <NuxtLink
            :to="localePath(pzRoutes.challenge)"
            class="inline-flex min-h-(--pz-tap-min) items-center text-sm font-semibold text-primary hover:underline"
          >
            {{ totalCount > 0 ? `Svi (${totalCount})` : 'Otvori' }}
          </NuxtLink>
        </div>
        <p class="text-muted">
          Odaberi igru, pošalji kôd i usporedite rezultate.
        </p>
        <template v-if="homeHighlight">
          <HeritageChallengeResumeCard :item="homeHighlight" />
          <p
            v-if="newPlayersFor(homeHighlight) > 0"
            class="text-sm text-muted"
          >
            Novih igrača: {{ newPlayersFor(homeHighlight) }}
          </p>
        </template>
        <form
          class="flex flex-col gap-1.5"
          novalidate
          @submit.prevent="openCode"
        >
          <label
            for="hub-code"
            class="text-sm font-semibold text-highlighted"
          >Imaš kôd izazova?</label>
          <div class="flex gap-2">
            <UInput
              id="hub-code"
              v-model="code"
              class="min-w-0 flex-1"
              size="xl"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              placeholder="npr. aB3x9KqLm2Zp0wQr"
              :aria-describedby="codeError ? 'hub-code-error' : undefined"
              :aria-invalid="codeError ? 'true' : undefined"
            />
            <UButton
              type="submit"
              label="Otvori"
              color="neutral"
              variant="outline"
              size="xl"
              data-testid="hub-code-open"
            />
          </div>
          <p
            v-if="codeError"
            id="hub-code-error"
            class="text-sm text-error"
            role="alert"
          >
            {{ codeError }}
          </p>
        </form>
        <UButton
          :to="localePath(pzRoutes.challengeNew)"
          label="Novi izazov"
          icon="i-lucide-swords"
          color="neutral"
          variant="outline"
          size="lg"
          block
          data-testid="hub-challenge-new"
        />
      </section>
    </div>
  </UContainer>
</template>
