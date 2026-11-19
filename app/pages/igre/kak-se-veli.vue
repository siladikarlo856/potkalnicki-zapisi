<script setup lang="ts">
import { gameDefinition } from '~~/shared/utils/games/definitions'
import { mulberry32 } from '~~/shared/utils/games/rng'
import { generateQuestions } from '~~/shared/utils/games/questions'
import type { Difficulty, GameQuestion } from '~~/shared/utils/games/types'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const game = gameDefinition('rijec')

const GAME_LENGTH = 10
const { t } = useI18n()
const { pool, status, error, refresh } = useCardPool()
const seed = useState('heritage-kak-se-veli-seed', () => Math.floor(Math.random() * 4294967296))
const difficulty = ref<Difficulty>('srednje')
const questions = shallowRef<GameQuestion[]>([])
const started = ref(false)
const loading = computed(() => !error.value && (status.value === 'idle' || status.value === 'pending'))
// A word game needs at least a few words to build options from.
const hasWords = computed(() => pool.value.cards.filter(card => card.kind === 'word').length >= 3)

function newRound() {
  return generateQuestions(game.id, pool.value, {
    topics: ['rijeci'],
    difficulty: difficulty.value,
    count: GAME_LENGTH,
    rng: mulberry32(seed.value),
    wordStatus: 'any'
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
  title: () => t('pz.play.askTitle'),
  ogTitle: () => `${t('pz.play.askTitle')} · Potkalnički zapisi`,
  ogDescription: () => t('pz.play.askDescription'),
  description: () => t('pz.play.askDescription')
})
</script>

<template>
  <GamesScreen
    :title="t('pz.play.askTitle')"
    :lead="t('pz.play.askDescription')"
    :loading="loading"
    :error="Boolean(error)"
    :empty="!hasWords"
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
        :title="t('pz.play.askTitle')"
        :questions="questions"
        :topics="['rijeci']"
        :difficulty="difficulty"
        @restart="restart"
      />
    </template>
  </GamesScreen>
</template>
