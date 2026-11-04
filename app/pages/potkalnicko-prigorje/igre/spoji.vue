<script setup lang="ts">
import { mulberry32 } from '~~/shared/utils/games/rng'
import {
  generateHeritageMatchBoards,
  HERITAGE_MATCH_PAIRS
} from '~~/shared/utils/games/heritageMatch'
import type { HeritageMatchBoard } from '~~/shared/utils/games/heritageMatch'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const { pool, status, error, refresh } = useCardPool()
const { recordBest } = useGameScores()
const seed = useState('heritage-spoji-seed', () => Math.floor(Math.random() * 4294967296))
const topics = ['bastina-crkve'] as const

const boards = shallowRef<HeritageMatchBoard[]>([])
const boardIndex = ref(0)
const started = ref(false)
const finished = ref(false)
const roundScores = ref<number[]>([])
const loading = computed(() => !error.value && (status.value === 'idle' || status.value === 'pending'))

const maxScore = computed(() => boards.value.length * HERITAGE_MATCH_PAIRS)
const totalScore = computed(() => roundScores.value.reduce((a, b) => a + b, 0))

const hasItems = computed(() =>
  pool.value.cards.filter(c => c.kind === 'item' && c.settlementId).length >= HERITAGE_MATCH_PAIRS
)

function newGame() {
  boards.value = generateHeritageMatchBoards(pool.value, [...topics], mulberry32(seed.value))
  boardIndex.value = 0
  roundScores.value = []
  finished.value = boards.value.length === 0
  started.value = boards.value.length > 0
}

function onBoardComplete(firstTryScore: number) {
  roundScores.value = [...roundScores.value, firstTryScore]
  if (boardIndex.value + 1 >= boards.value.length) {
    finished.value = true
    recordBest('spoji', totalScore.value, maxScore.value)
    return
  }
  boardIndex.value += 1
}

function restart() {
  seed.value = (seed.value + 1) >>> 0
  finished.value = false
  newGame()
}

useSeoMeta({
  title: () => t('pz.play.matchTitle'),
  ogTitle: () => `${t('pz.play.matchTitle')} · Potkalnički zapisi`,
  ogDescription: () => t('pz.play.matchDescription'),
  description: () => t('pz.play.matchDescription')
})
</script>

<template>
  <UContainer class="py-3 sm:py-5 lg:py-6">
    <div class="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-3">
      <header>
        <p class="mb-1 text-xs font-semibold text-primary">
          {{ t('pz.play.matchEyebrow') }}
        </p>
        <h1 class="text-2xl font-bold tracking-tight text-highlighted sm:text-3xl">
          {{ t('pz.play.matchTitle') }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ t('pz.play.matchDescription') }}
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
        v-else-if="!hasItems"
        class="rounded-xl bg-default p-4 text-center ring ring-default"
        role="status"
      >
        <h2 class="text-xl font-bold text-highlighted">
          {{ t('quiz.emptyTitle') }}
        </h2>
        <p class="mt-1 text-sm text-muted">
          {{ t('pz.play.emptyBastina') }}
        </p>
      </div>
      <div
        v-else-if="!started"
        class="rounded-xl bg-default p-4 ring ring-default sm:p-5"
      >
        <p class="text-sm text-muted">
          {{ t('pz.play.matchHint') }}
        </p>
        <UButton
          class="mt-3"
          :label="t('pz.play.start')"
          icon="i-lucide-play"
          size="xl"
          block
          data-testid="match-start-button"
          @click="newGame"
        />
      </div>
      <GamesHeritageMatch
        v-else-if="!finished && boards[boardIndex]"
        :board="boards[boardIndex]!"
        :board-index="boardIndex"
        :board-count="boards.length"
        @complete="onBoardComplete"
      />
      <div
        v-else
        class="flex flex-col items-center gap-3 rounded-xl bg-default p-4 text-center ring ring-default sm:p-6"
        data-testid="match-result"
      >
        <h2 class="text-xl font-bold text-highlighted">
          {{ t('pz.play.done') }}
        </h2>
        <p
          role="status"
          class="text-lg font-semibold text-highlighted"
          data-testid="match-result-score"
        >
          {{ t('pz.play.resultOf', { correct: totalScore, n: maxScore }) }}
        </p>
        <UButton
          :label="t('pz.play.again')"
          icon="i-lucide-rotate-ccw"
          size="lg"
          data-testid="match-replay"
          @click="restart"
        />
      </div>
    </div>
  </UContainer>
</template>
