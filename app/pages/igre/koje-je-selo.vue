<script setup lang="ts">
import { gameDefinition } from '~~/shared/utils/games/definitions'
import { mulberry32 } from '~~/shared/utils/games/rng'
import { generateQuestions } from '~~/shared/utils/games/questions'
import type { Difficulty, GameQuestion } from '~~/shared/utils/games/types'
import type { PoolPlace } from '~~/shared/utils/learn/types'

const GAME_LENGTH = 10

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const game = gameDefinition('karta-koje')

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
  return generateQuestions(game.id, pool.value, {
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
  <GamesScreen
    :title="t('pz.map.whichTitle')"
    :lead="t('pz.map.whichBlurb')"
    :loading="loading"
    :error="Boolean(error)"
    :empty="false"
    :started="started"
    @retry="refresh()"
  >
    <template #start>
      <GamesStart
        v-model:difficulty="difficulty"
        :game-id="game.id"
        :disabled="places.length < 4"
        @start="start"
      />
    </template>
    <template #round>
      <GamesShell
        :game-id="game.id"
        :title="t('pz.map.whichTitle')"
        :questions="questions"
        :topics="['mjesta']"
        :difficulty="difficulty"
        @restart="restart"
      >
        <template #default="{ question, selected, pending, answered, pick, check }">
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
            :pending="pending"
            labelledby="game-question"
            @select="pick"
            @submit="check()"
          />
        </template>
      </GamesShell>
    </template>
  </GamesScreen>
</template>
