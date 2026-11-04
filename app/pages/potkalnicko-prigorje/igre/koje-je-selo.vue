<script setup lang="ts">
import { mulberry32 } from '~~/shared/utils/games/rng'
import { generateQuestions } from '~~/shared/utils/games/questions'
import type { Difficulty, GameQuestion } from '~~/shared/utils/games/types'
import type { PoolPlace } from '~~/shared/utils/learn/types'

const GAME_LENGTH = 10

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const { pool, status, error, refresh } = useCardPool()

const seed = useState('heritage-koje-selo-seed', () => Math.floor(Math.random() * 4294967296))
const difficulty = ref<Difficulty>('srednje')
const questions = shallowRef<GameQuestion[]>([])
const started = ref(false)
const loading = computed(() => !error.value && (status.value === 'idle' || status.value === 'pending'))
const places = computed(() => pool.value.cards.filter((c): c is PoolPlace => c.kind === 'place'))
const municipalities = computed(() => pool.value.municipalities)

function newRound() {
  return generateQuestions('karta-koje', pool.value, {
    topics: ['mjesta'],
    difficulty: difficulty.value,
    count: GAME_LENGTH,
    rng: mulberry32(seed.value)
  })
}

function start() {
  questions.value = newRound()
  started.value = questions.value.length > 0
}

function restart() {
  seed.value = (seed.value + 1) >>> 0
  questions.value = newRound()
}

function placeFor(question: GameQuestion): PoolPlace | undefined {
  const id = question.card.slice('place:'.length)
  return places.value.find(p => p.id === id)
}

useSeoMeta({
  title: () => t('pz.map.whichTitle'),
  description: () => t('pz.map.whichBlurb')
})
</script>

<template>
  <UContainer class="py-3 sm:py-5 lg:py-6">
    <div class="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-3">
      <header>
        <p class="mb-1 text-xs font-semibold text-primary">
          {{ t('pz.map.whichTitle') }}
        </p>
        <h1 class="text-2xl font-bold tracking-tight text-highlighted sm:text-3xl">
          {{ t('pz.map.whichTitle') }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ t('pz.map.whichBlurb') }}
        </p>
      </header>

      <div
        v-if="error || loading"
        class="rounded-xl bg-default p-4 ring ring-default"
        role="status"
      >
        <p>{{ t(error ? 'quiz.loadError' : 'quiz.loading') }}</p>
        <UButton
          v-if="error"
          :label="t('quiz.retry')"
          variant="link"
          @click="refresh()"
        />
      </div>

      <GamesStart
        v-else-if="!started"
        v-model:difficulty="difficulty"
        :disabled="places.length < 4"
        @start="start"
      />

      <GamesShell
        v-else-if="questions.length"
        game-id="karta-koje"
        :title="t('pz.map.whichTitle')"
        :questions="questions"
        :topics="['mjesta']"
        :difficulty="difficulty"
        @restart="restart"
      >
        <template #default="{ question, selected, answered, answer }">
          <GamesMapView
            v-if="placeFor(question)"
            class="mb-3"
            :places="places"
            :municipalities="municipalities"
            :difficulty="difficulty"
            mode="target"
            single-target
            :highlight-id="placeFor(question)!.id"
            :disabled="answered"
            data-testid="map-which-view"
          />
          <GamesOptions
            :question="question"
            :selected="selected"
            labelledby="game-question"
            @select="answer"
          />
        </template>
      </GamesShell>
    </div>
  </UContainer>
</template>
