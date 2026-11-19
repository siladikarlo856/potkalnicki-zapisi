<script setup lang="ts">
import { pzRoutes } from '~~/shared/utils/appRoutes'
import { dailyRevealedLetters } from '~~/shared/utils/dailyWord'
import { dailyDateLabel } from '~/utils/dailyClues'

// The one thing to do today, on Početna and on the play hub: the only large ochre surface on a page. Not played:
// the first clue as the headline, the first letter, "Pogodi riječ". Solved: the word, its meaning, the streak and
// the countdown. The word is never in the markup until the round is over.
const { t } = useI18n()
const localePath = useLocalePath()
const { payload, clues, refresh, error, unavailable, replaced, finished, solvedStreak, brokenStreak, loading, ready } = useDailyToday()
const countdown = useDailyCountdown(() => payload.value?.nextAt)

const titleId = useId()
const done = computed(() => !!finished.value)
const headline = computed(() => clues.value[0] ?? '')
const slots = computed(() => payload.value ? dailyRevealedLetters(payload.value.entry.headword, 0) : [])
const solved = computed(() => !!finished.value?.solved)
const overline = computed(() => payload.value
  ? solved.value ? 'Riječ dana · riješeno' : `Riječ dana · ${dailyDateLabel(payload.value.day)}`
  : 'Riječ dana')
const cluesTotal = computed(() => clues.value.length)
</script>

<template>
  <div
    v-if="loading || (!error && !ready)"
    class="min-h-56 animate-pulse rounded-(--pz-radius-lg) bg-muted motion-reduce:animate-none"
    role="status"
    data-testid="daily-card-skeleton"
  >
    <span class="sr-only">Učitavanje riječi dana…</span>
  </div>

  <section
    v-else-if="error || !payload"
    class="rounded-(--pz-radius-lg) border border-default bg-muted p-4 sm:p-5"
    :aria-labelledby="titleId"
    data-testid="daily-card-unavailable"
  >
    <p class="pz-overline text-muted">
      Riječ dana
    </p>
    <h2
      :id="titleId"
      class="pz-h3 mt-1 text-highlighted"
    >
      Riječ dana danas nije dostupna.
    </h2>
    <UButton
      v-if="error && !unavailable"
      class="mt-3"
      label="Pokušaj ponovno"
      color="neutral"
      variant="outline"
      @click="refresh()"
    />
  </section>

  <section
    v-else
    class="flex flex-col gap-3 rounded-(--pz-radius-lg) border border-transparent bg-(--pz-accent) p-4 text-(--pz-on-accent) sm:p-5"
    :aria-labelledby="titleId"
    data-testid="daily-card"
  >
    <p class="pz-overline">
      {{ overline }}
    </p>
    <UBadge
      v-if="payload.sample"
      :label="t('daily.sample')"
      color="neutral"
      variant="outline"
      class="self-start"
      data-testid="daily-sample"
    />

    <template v-if="!done">
      <h2
        :id="titleId"
        class="pz-h2"
        lang="hr"
      >
        {{ headline }}
      </h2>
      <LetterSlots
        :letters="slots"
        on-accent
      />
      <UButton
        :to="localePath(pzRoutes.daily)"
        label="Pogodi riječ"
        trailing-icon="i-lucide-arrow-right"
        color="neutral"
        size="lg"
        block
        class="bg-(--pz-on-accent) text-white hover:bg-(--pz-on-accent)/90"
        data-testid="daily-card-play"
      />
      <p class="text-sm">
        Trag 1 od {{ cluesTotal }} · nova riječ za {{ countdown }}
      </p>
    </template>

    <template v-else>
      <h2
        :id="titleId"
        class="pz-h2"
      >
        <template v-if="replaced">
          {{ solved ? 'Današnja je riječ riješena' : 'Danas nije išlo' }}
        </template>
        <template v-else>
          <span lang="hr">{{ payload.entry.headword }}</span>
          <span class="font-normal"> ({{ payload.entry.meaning.hr }})</span>
        </template>
      </h2>
      <p v-if="!solved && !replaced">
        Danas nije išlo. Sutra počinje novi niz.
      </p>
      <p v-if="solved && solvedStreak > 0">
        <StreakCounter
          :days="solvedStreak"
          on-accent
        />
      </p>
      <p
        v-else-if="!solved && brokenStreak > 0"
        class="text-sm"
      >
        Niz od {{ brokenStreak }} dana je prekinut.
      </p>
      <p class="text-sm">
        Nova riječ za {{ countdown }}.
      </p>
      <NuxtLink
        :to="localePath(pzRoutes.daily)"
        class="inline-flex min-h-(--pz-tap-min) items-center gap-1 self-start text-sm font-semibold underline underline-offset-2"
      >
        Pogledaj rezultat
      </NuxtLink>
    </template>
  </section>
</template>
