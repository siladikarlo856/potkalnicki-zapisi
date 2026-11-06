<script setup lang="ts">
import { mulberry32 } from '~~/shared/utils/games/rng'
import { generateQuestions } from '~~/shared/utils/games/questions'
import { gameDefinition } from '~~/shared/utils/games/definitions'
import type { Difficulty, GameQuestion } from '~~/shared/utils/games/types'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const game = gameDefinition('osoba')

const GAME_LENGTH = 10
const { t } = useI18n()
const { pool, status, error, refresh } = useCardPool()
const seed = useState('heritage-tko-je-to-seed', () => Math.floor(Math.random() * 4294967296))
const difficulty = ref<Difficulty>('srednje')
const questions = shallowRef<GameQuestion[]>([])
const started = ref(false)
const loading = computed(() => !error.value && (status.value === 'idle' || status.value === 'pending'))
const hasPersons = computed(() => pool.value.cards.filter(card => card.kind === 'person').length >= 4)

function newRound() {
  return generateQuestions(game.id, pool.value, {
    topics: ['osobe'],
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

useSeoMeta({
  title: () => t('pz.play.whoTitle'),
  ogTitle: () => `${t('pz.play.whoTitle')} · Potkalnički zapisi`,
  ogDescription: () => t('pz.play.whoDescription'),
  description: () => t('pz.play.whoDescription')
})
</script>

<template>
  <UContainer class="py-3 sm:py-5 lg:py-6">
    <div class="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-3">
      <header>
        <p class="mb-1 text-xs font-semibold text-primary">
          {{ t('pz.play.whoEyebrow') }}
        </p>
        <h1 class="text-2xl font-bold tracking-tight text-highlighted sm:text-3xl">
          {{ t('pz.play.whoTitle') }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ t('pz.play.whoDescription') }}
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
      <div
        v-else-if="!hasPersons"
        class="rounded-xl bg-default p-4 text-center ring ring-default"
        role="status"
      >
        <h2 class="text-xl font-bold text-highlighted">
          {{ t('quiz.emptyTitle') }}
        </h2>
        <p class="mt-1 text-sm text-muted">
          {{ t('quiz.emptyDescription') }}
        </p>
      </div>
      <GamesStart
        v-else-if="!started"
        v-model:difficulty="difficulty"
        @start="start"
      />
      <GamesShell
        v-else
        :game-id="game.id"
        :title="t('pz.play.whoTitle')"
        :questions="questions"
        :topics="['osobe']"
        :difficulty="difficulty"
        @restart="restart"
      />
    </div>
  </UContainer>
</template>
