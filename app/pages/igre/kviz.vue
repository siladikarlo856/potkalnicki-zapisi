<script setup lang="ts">
import { gameDefinition } from '~~/shared/utils/games/definitions'
import { mulberry32 } from '~~/shared/utils/games/rng'
import { generateQuestions } from '~~/shared/utils/games/questions'
import type { GameQuestion } from '~~/shared/utils/games/types'
import { QUIZ_LENGTH } from '~/utils/multipleChoice'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const game = gameDefinition('znacenje')

const { locale, t } = useI18n()
const { pool, status, error, refresh } = useCardPool()
// The word entries carry the variants and examples the feedback shows; the questions come from the card pool.
const { words } = useHeritage()
// Nuxt carries the seed to the client, keeping server rendering and hydration identical.
const seed = useState('heritage-quiz-seed', () => Math.floor(Math.random() * 4294967296))
const questions = shallowRef<GameQuestion[]>([])
const variantOpen = ref(false)
const started = ref(false)
const wordsById = computed(() => new Map(words.value.map(word => [word.id, word])))
const loading = computed(() => !error.value && (status.value === 'idle' || status.value === 'pending'))

// `znacenje` keeps Srednje without a difficulty picker; the player starts the prepared round with "Počni".
function newRound() {
  return generateQuestions(game.id, pool.value, {
    topics: ['rijeci'],
    difficulty: 'srednje',
    count: QUIZ_LENGTH,
    rng: mulberry32(seed.value),
    wordStatus: 'any'
  })
}

watch(() => pool.value.cards, () => {
  questions.value = newRound()
}, { immediate: true })

function restart() {
  seed.value = (seed.value + 1) >>> 0
  questions.value = newRound()
}

function entryFor(question: GameQuestion) {
  return wordsById.value.get(question.card.slice('word:'.length))
}

useSeoMeta({
  title: () => t('quiz.title'),
  ogTitle: () => `${t('quiz.title')} · Potkalnički zapisi`,
  ogDescription: () => t('quiz.description'),
  description: () => t('quiz.description')
})
</script>

<template>
  <GamesScreen
    :title="t('quiz.title')"
    :lead="t('quiz.description')"
    :loading="loading"
    :error="Boolean(error)"
    :empty="!questions.length && !loading"
    empty-description="Za kviz treba barem dva različita značenja aktivnih riječi. Dotad pokušaj neku drugu igru ili pomozi dodati riječi."
    :started="started"
    @retry="refresh()"
  >
    <template #start>
      <GamesStart
        :game-id="game.id"
        :levels="false"
        @start="started = true"
      />
    </template>
    <template #round>
      <GamesShell
        :game-id="game.id"
        :questions="questions"
        :topics="['rijeci']"
        difficulty="srednje"
        @restart="restart"
      >
        <template #feedback="{ question }">
          <template v-if="entryFor(question)">
            <p
              v-if="entryFor(question)!.examples?.[0]"
              class="text-xs"
            >
              <span class="mr-1 text-muted">{{ t('quiz.example') }}</span>
              <span lang="hr"><i>{{ entryFor(question)!.examples![0]!.text }}</i><span
                v-if="entryFor(question)!.examples![0]!.translation"
                class="text-muted"
              > — {{ entryFor(question)!.examples![0]!.translation }}</span></span>
            </p>
            <div class="max-h-32 min-w-0 overflow-y-auto sm:max-h-48">
              <h3 class="mb-1 text-xs font-semibold text-muted">
                {{ t('quiz.variants') }}
              </h3>
              <HeritageVariantList
                :entry="entryFor(question)!"
                :english="locale === 'en'"
                lang="hr"
              />
            </div>
            <UButton
              :label="t('game.differently')"
              icon="i-lucide-message-square-plus"
              color="neutral"
              variant="link"
              size="sm"
              class="self-start px-0 print:hidden"
              aria-haspopup="dialog"
              data-testid="quiz-differently"
              @click="variantOpen = true"
            />
            <HeritageVariantDialog
              v-model:open="variantOpen"
              :entry="entryFor(question)!"
            />
          </template>
        </template>
      </GamesShell>
    </template>
  </GamesScreen>
</template>
