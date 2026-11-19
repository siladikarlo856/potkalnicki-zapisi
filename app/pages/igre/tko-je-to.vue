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
  <GamesScreen
    :title="t('pz.play.whoTitle')"
    :lead="t('pz.play.whoDescription')"
    :loading="loading"
    :error="Boolean(error)"
    :empty="!hasPersons"
    :started="started"
    @retry="refresh()"
  >
    <template #start>
      <GamesStart
        v-model:difficulty="difficulty"
        :game-id="game.id"
        @start="start"
      />
    </template>
    <template #round>
      <GamesShell
        :game-id="game.id"
        :title="t('pz.play.whoTitle')"
        :questions="questions"
        :topics="['osobe']"
        :difficulty="difficulty"
        @restart="restart"
      />
    </template>
  </GamesScreen>
</template>
