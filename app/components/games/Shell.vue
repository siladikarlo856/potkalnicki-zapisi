<script setup lang="ts">
import { mulberry32, shuffled } from '~~/shared/utils/games/rng'
import { decodeCardKey } from '~~/shared/utils/games/cardKey'
import { gameDefinition } from '~~/shared/utils/games/definitions'
import type { Difficulty, GameId, GameQuestion } from '~~/shared/utils/games/types'
import type { QuizChallengeInput } from '~~/shared/utils/challenge'
import type { CardKey, TopicId } from '~~/shared/utils/learn/types'
import type { DotState } from '~/utils/questionDots'

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
const { recordBest, scores } = useGameScores()

const lang = computed(() => locale.value === 'en' ? 'en' : 'hr')
const roundTitle = computed(() => props.title ?? gameDefinition(props.gameId).label[lang.value])
const round = shallowRef<GameQuestion[]>(props.questions)
const practice = ref(false)
const index = ref(0)
/** Marked but not yet checked: "Provjeri" locks it. */
const pending = ref<number | null>(null)
/** The option the answer was checked with. */
const selected = ref<number | null>(null)
const results = ref<boolean[]>([])
const skipped = ref<boolean[]>([])
const startedAt = ref(Date.now())
const elapsedSeconds = ref(0)
const previousBest = ref<{ score: number, max: number } | null>(null)

const question = computed(() => round.value[index.value])
const answered = computed(() => selected.value !== null)
const finished = computed(() => index.value >= round.value.length)
const isCorrect = computed(() => Boolean(question.value) && selected.value === question.value!.correct)
const score = computed(() => results.value.filter(Boolean).length)
const wordId = (card: CardKey) => decodeCardKey(card)?.id ?? ''
const isWordCard = (card: CardKey) => decodeCardKey(card)?.kind === 'word'
const dotStates = computed<DotState[]>(() => round.value.map((_, i) =>
  skipped.value[i] ? 'skipped' : results.value[i] === undefined ? 'upcoming' : results.value[i] ? 'right' : 'wrong'))

// The creator's own round is kept for `znacenje` challenges ("Moja runda"): option cards map back to word ids.
const quizPayload = computed<QuizChallengeInput | null>(() => {
  if (props.gameId !== 'znacenje' || practice.value || !round.value.length) return null
  if (!round.value.every(item => item.optionCards?.length === item.options.length && isWordCard(item.card))) return null
  return {
    questions: round.value.map(item => ({ id: wordId(item.card), optionIds: item.optionCards!.map(wordId) })),
    results: results.value
  }
})

// The action bar takes the tab bar's place while a round is in play; the result brings the tab bar back.
useHidePzTabBar(() => Boolean(question.value), 'game')

const heading = useTemplateRef<HTMLElement>('heading')
const feedback = useTemplateRef<{ focus: () => void }>('feedback')
const result = useTemplateRef<{ focus: () => void }>('result')

function reset(questions: GameQuestion[]) {
  round.value = questions
  practice.value = false
  index.value = 0
  pending.value = null
  selected.value = null
  results.value = []
  skipped.value = []
  startedAt.value = Date.now()
}

watch(() => props.questions, async (questions) => {
  reset(questions)
  await nextTick()
  heading.value?.focus()
})

function pick(option: number) {
  const current = question.value
  if (!current || answered.value || option < 0 || option >= current.options.length) return
  pending.value = option
}

/** Locks an option and shows the feedback. Without an argument it checks the marked one ("Provjeri"). */
async function answer(option: number | null = pending.value) {
  const current = question.value
  if (!current || answered.value || option === null || option < 0 || option >= current.options.length) return
  const right = option === current.correct
  pending.value = null
  selected.value = option
  results.value = [...results.value, right]
  skipped.value = [...skipped.value, false]
  recordAnswer(current.card, right)
  await nextTick()
  feedback.value?.focus()
}

/** "Preskoči": counts as not right, shows no feedback and leaves the card's progress alone. */
async function skip() {
  if (!question.value || answered.value) return
  results.value = [...results.value, false]
  skipped.value = [...skipped.value, true]
  await advance()
}

async function advance() {
  index.value += 1
  pending.value = null
  selected.value = null
  if (finished.value) {
    elapsedSeconds.value = Math.max(1, Math.round((Date.now() - startedAt.value) / 1000))
    if (!practice.value) {
      const best = scores.value.best[props.gameId]
      previousBest.value = best ? { score: best.score, max: best.max } : null
      recordBest(props.gameId, score.value, round.value.length)
    }
    await nextTick()
    result.value?.focus()
    return
  }
  await nextTick()
  heading.value?.focus()
}

async function next() {
  if (!answered.value) return
  await advance()
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
    class="flex min-w-0 flex-col"
    :data-testid="`game-shell-${gameId}`"
  >
    <template v-if="question">
      <RoundBar
        :title="roundTitle"
        :current="index + 1"
        :total="round.length"
        :score="score"
      />

      <UContainer class="flex-1 py-4 sm:py-6">
        <div class="mx-auto grid w-full min-w-0 gap-6 lg:grid-cols-[minmax(0,600px)_320px] lg:justify-center lg:gap-10">
          <div class="flex min-w-0 flex-col gap-4">
            <section
              class="min-w-0"
              aria-labelledby="game-question"
            >
              <p class="pz-overline mb-1 text-muted">
                Pitanje {{ index + 1 }} od {{ round.length }}
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
                :pending="pending"
                :answered="answered"
                :answer="answer"
                :pick="pick"
              >
                <GamesOptions
                  :question="question"
                  :selected="selected"
                  :pending="pending"
                  labelledby="game-question"
                  @select="pick"
                  @submit="answer()"
                />
              </slot>
            </section>

            <GamesFeedback
              v-if="answered"
              ref="feedback"
              :correct="isCorrect"
              :answer="isCorrect ? undefined : question.options[question.correct]![lang]"
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
          </div>

          <aside
            class="hidden lg:block"
            aria-label="Napredak u igri"
            data-testid="game-side-panel"
          >
            <div class="sticky top-20 flex flex-col gap-4 rounded-(--pz-radius-lg) border border-default bg-default p-4">
              <h2 class="pz-overline text-muted">
                Pitanja
              </h2>
              <QuestionDots
                :states="dotStates"
                :current="index"
              />
              <p class="pz-body-sm text-default tabular-nums">
                Točno: {{ score }} od {{ results.length }}
              </p>
            </div>
          </aside>
        </div>
      </UContainer>

      <ActionBar data-testid="game-action-bar">
        <template v-if="!answered">
          <UButton
            label="Preskoči"
            color="neutral"
            variant="outline"
            size="lg"
            data-testid="game-skip"
            @click="skip"
          />
          <UButton
            label="Provjeri"
            size="lg"
            :disabled="pending === null"
            data-testid="game-check"
            @click="answer()"
          />
        </template>
        <UButton
          v-else
          :label="index + 1 >= round.length ? 'Pogledaj rezultat' : 'Dalje'"
          trailing-icon="i-lucide-arrow-right"
          size="lg"
          data-testid="game-next"
          @click="next"
        />
      </ActionBar>
    </template>

    <UContainer
      v-else
      class="py-6 sm:py-10"
    >
      <div class="mx-auto w-full min-w-0 max-w-xl">
        <GamesResult
          ref="result"
          :game-id="gameId"
          :title="roundTitle"
          :questions="round"
          :results="results"
          :skipped="skipped"
          :seconds="elapsedSeconds"
          :previous-best="previousBest"
          :practice="practice"
          :quiz-payload="quizPayload"
          @restart="emit('restart')"
          @replay-missed="replayMissed"
        />
      </div>
    </UContainer>
  </div>
</template>
