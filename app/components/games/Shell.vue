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

// The sticky action bar takes the tab bar's place while a round is in play; the result brings it back.
useHidePzTabBar(() => Boolean(question.value), 'game')

const heading = useTemplateRef<HTMLElement>('heading')
const feedback = useTemplateRef<{ focus: () => void }>('feedback')
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
    class="flex min-w-0 flex-col gap-3"
    :data-testid="`game-shell-${gameId}`"
  >
    <template v-if="question">
      <GamesProgress
        :current="index + 1"
        :total="round.length"
        :results="results"
        :score="score"
      />

      <section
        class="min-w-0 rounded-(--pz-radius-lg) border border-default bg-default p-4"
        aria-labelledby="game-question"
      >
        <p class="pz-overline mb-1 text-muted">
          {{ title }}
        </p>
        <h2
          id="game-question"
          ref="heading"
          tabindex="-1"
          :lang="lang"
          class="pz-h2 mb-4 wrap-anywhere text-highlighted outline-offset-4"
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
      </section>

      <GamesFeedback
        v-if="answered"
        ref="feedback"
        :correct="isCorrect"
        :answer="question.options[question.correct]![lang]"
        :explanation="question.explanation[lang]"
        :lang="lang"
        :sr-extra="t('pz.play.score', { score })"
      >
        <slot
          name="feedback"
          :question="question"
          :correct="isCorrect"
        />
        <template #links>
          <UButton
            v-if="question.archivePath"
            :to="localePath(question.archivePath)"
            :label="t('pz.play.openRecord')"
            icon="i-lucide-book-open"
            color="neutral"
            variant="link"
            class="min-h-(--pz-tap-min) px-0 font-semibold"
            data-testid="game-open-record"
          />
          <GamesCorrection :card="question.card" />
        </template>
      </GamesFeedback>

      <GamesDalje
        v-if="answered"
        :last="index + 1 >= round.length"
        @next="next"
      />
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
