<script setup lang="ts">
import { mulberry32, shuffled } from '~~/shared/utils/games/rng'
import { decodeCardKey } from '~~/shared/utils/games/cardKey'
import { gameDefinition } from '~~/shared/utils/games/definitions'
import type { Difficulty, GameId, GameQuestion } from '~~/shared/utils/games/types'
import type { QuizChallengeInput } from '~~/shared/utils/challenge'
import type { CardKey, TopicId } from '~~/shared/utils/learn/types'

// One engine for every game: header, the renderer (default slot), feedback, "Dalje" and the end screen.
// The shell owns the round state; renderers only show the question and report which option was picked.
const props = defineProps<{
  gameId: GameId
  /** Defaults to the game's label. */
  title?: string
  questions: GameQuestion[]
  topics?: TopicId[]
  difficulty?: Difficulty
}>()
const emit = defineEmits<{ restart: [] }>()

const { t, locale } = useI18n()
const localePath = useLocalePath()
const { recordAnswer } = useProgress()
const { recordBest } = useGameScores()

const lang = computed(() => locale.value === 'en' ? 'en' : 'hr')
const roundTitle = computed(() => props.title ?? gameDefinition(props.gameId).label[lang.value])
const round = shallowRef<GameQuestion[]>(props.questions)
const practice = ref(false)
const index = ref(0)
const selected = ref<number | null>(null)
const results = ref<boolean[]>([])

const question = computed(() => round.value[index.value])
const answered = computed(() => selected.value !== null)
const finished = computed(() => index.value >= round.value.length)
const isCorrect = computed(() => Boolean(question.value) && selected.value === question.value!.correct)
const score = computed(() => results.value.filter(Boolean).length)
const completed = computed(() => index.value + Number(answered.value))
const wordId = (card: CardKey) => decodeCardKey(card)?.id ?? ''
const isWordCard = (card: CardKey) => decodeCardKey(card)?.kind === 'word'

// The creator's own round is kept for `znacenje` challenges ("Moja runda"): option cards map back to word ids.
const quizPayload = computed<QuizChallengeInput | null>(() => {
  if (props.gameId !== 'znacenje' || practice.value || !round.value.length) return null
  if (!round.value.every(item => item.optionCards?.length === item.options.length && isWordCard(item.card))) return null
  return {
    questions: round.value.map(item => ({ id: wordId(item.card), optionIds: item.optionCards!.map(wordId) })),
    results: results.value
  }
})

const announcement = computed(() => {
  const current = question.value
  if (!current || !answered.value) return ''
  return `${t(isCorrect.value ? 'pz.play.right' : 'pz.play.wrong')} ${t('pz.play.correctAnswer', { answer: current.options[current.correct]![lang.value] })} ${t('pz.play.score', { score: score.value })}`
})

const heading = useTemplateRef<HTMLElement>('heading')
const feedback = useTemplateRef<HTMLElement>('feedback')
const result = useTemplateRef<{ focus: () => void }>('result')

function reset(questions: GameQuestion[]) {
  round.value = questions
  practice.value = false
  index.value = 0
  selected.value = null
  results.value = []
}

watch(() => props.questions, async (questions) => {
  reset(questions)
  await nextTick()
  heading.value?.focus()
})

async function answer(option: number) {
  const current = question.value
  if (!current || answered.value || option < 0 || option >= current.options.length) return
  const right = option === current.correct
  selected.value = option
  results.value = [...results.value, right]
  recordAnswer(current.card, right)
  await nextTick()
  feedback.value?.focus()
}

async function next() {
  if (!answered.value) return
  index.value += 1
  selected.value = null
  if (finished.value) {
    if (!practice.value) recordBest(props.gameId, score.value, round.value.length)
    await nextTick()
    result.value?.focus()
    return
  }
  await nextTick()
  heading.value?.focus()
}

/** A fresh round of only the missed questions, with new orders for the questions and their choices. */
async function replayMissed() {
  const rng = mulberry32(Math.floor(Math.random() * 4294967296))
  const missed = round.value.filter((_, i) => results.value[i] === false).map((item) => {
    const order = shuffled(item.options.map((_, i) => i), rng)
    return {
      ...item,
      options: order.map(i => item.options[i]!),
      correct: order.indexOf(item.correct),
      ...(item.optionCards ? { optionCards: order.map(i => item.optionCards![i]!) } : {})
    }
  })
  reset(shuffled(missed, rng))
  practice.value = true
  await nextTick()
  heading.value?.focus()
}

defineExpose({ answer, next })
</script>

<template>
  <div
    class="flex min-w-0 flex-col gap-2.5"
    :data-testid="`game-shell-${gameId}`"
  >
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="sr-only"
    >
      {{ announcement }}
    </p>

    <template v-if="question">
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span data-testid="game-progress">{{ t('pz.play.questionOf', { i: index + 1, n: round.length }) }}</span>
        <span data-testid="game-score">{{ t('pz.play.score', { score }) }}</span>
      </div>
      <UProgress
        :model-value="completed"
        :max="round.length"
        size="sm"
        :get-value-label="() => t('pz.play.progressLabel')"
        :get-value-text="(value, max) => t('pz.play.answeredProgress', { count: value, total: max })"
        :ui="{ indicator: 'motion-reduce:transition-none' }"
      />

      <section
        class="min-w-0 rounded-xl bg-default p-3 shadow-sm ring ring-default sm:p-5"
        aria-labelledby="game-question"
      >
        <h2
          id="game-question"
          ref="heading"
          tabindex="-1"
          :lang="lang"
          class="mb-3 text-center text-2xl font-bold wrap-anywhere text-highlighted outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary sm:text-3xl"
          data-testid="game-prompt"
        >
          {{ question.prompt[lang] }}
        </h2>

        <slot
          :question="question"
          :selected="selected"
          :answered="answered"
          :answer="answer"
        >
          <GamesOptions
            :question="question"
            :selected="selected"
            labelledby="game-question"
            @select="answer"
          />
        </slot>

        <div
          v-if="answered"
          ref="feedback"
          tabindex="-1"
          role="status"
          aria-live="polite"
          class="mt-3 flex min-w-0 flex-col gap-2 border-t border-default pt-3 outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
          data-testid="game-feedback"
        >
          <UAlert
            :title="t(isCorrect ? 'pz.play.right' : 'pz.play.wrong')"
            :icon="isCorrect ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
            :color="isCorrect ? 'success' : 'error'"
            variant="subtle"
          />
          <p
            class="text-base font-bold wrap-anywhere text-highlighted"
            :lang="lang"
          >
            {{ t('pz.play.correctAnswer', { answer: question.options[question.correct]![lang] }) }}
          </p>
          <p
            class="text-sm wrap-anywhere"
            :lang="lang"
          >
            {{ question.explanation[lang] }}
          </p>
          <slot
            name="feedback"
            :question="question"
            :correct="isCorrect"
          />
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 print:hidden">
            <UButton
              v-if="question.archivePath"
              :to="localePath(question.archivePath)"
              :label="t('pz.play.openRecord')"
              trailing-icon="i-lucide-arrow-right"
              color="neutral"
              variant="link"
              size="sm"
              class="px-0"
              data-testid="game-open-record"
            />
            <GamesCorrection :card="question.card" />
          </div>
        </div>
      </section>

      <div
        v-if="answered"
        class="print:hidden"
      >
        <UButton
          :label="t('pz.play.next')"
          trailing-icon="i-lucide-arrow-right"
          size="xl"
          block
          data-testid="game-next"
          @click="next"
        />
      </div>
    </template>

    <GamesResult
      v-else
      ref="result"
      :game-id="gameId"
      :title="roundTitle"
      :questions="round"
      :results="results"
      :practice="practice"
      :quiz-payload="quizPayload"
      @restart="emit('restart')"
      @replay-missed="replayMissed"
    />
  </div>
</template>
