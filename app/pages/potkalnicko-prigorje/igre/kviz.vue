<script setup lang="ts">
import { advanceMeaningGame, answerMeaningQuestion, createMeaningQuestions, isCorrectAnswer, limitQuestions, meaningOption, missedQuestions, replayMissedGame, seededRandom, startMeaningGame } from '~/utils/multipleChoice'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { locale, t } = useI18n()
const { words, status, error, refresh } = useHeritage()
// Nuxt carries the seed to the client, keeping server rendering and hydration identical.
const seed = useState('heritage-quiz-seed', () => Math.floor(Math.random() * 4294967296))
const meaningLocale = computed(() => locale.value === 'en' ? 'en' : 'hr')
const wordList = computed(() => toValue(words))
const newGame = () => startMeaningGame(limitQuestions(createMeaningQuestions(wordList.value, meaningLocale.value, seededRandom(seed.value))))
const game = ref(newGame())
// A round of only the missed questions is practice: it is not shared as a result.
const replayingMissed = ref(false)
const variantOpen = ref(false)
const question = computed(() => game.value.questions[game.value.index])
const answered = computed(() => game.value.selectedOptionId !== null)
const correct = computed(() => question.value && game.value.selectedOptionId !== null && isCorrectAnswer(question.value, game.value.selectedOptionId))
const example = computed(() => question.value?.entry.examples?.[0])
const meaning = computed(() => question.value ? meaningOption(question.value.entry, meaningLocale.value) : undefined)
const missed = computed(() => missedQuestions(game.value))
const missedReview = computed(() => missed.value.map(item => ({ id: item.entry.id, headword: item.entry.headword, meaning: meaningOption(item.entry, meaningLocale.value) })))
const challengeQuiz = computed(() => ({
  questions: game.value.questions.map(item => ({ id: item.entry.id, optionIds: item.options.map(option => option.id) })),
  results: game.value.results
}))
const hasSamples = computed(() => wordList.value.some(word => word.status === 'placeholder'))
const completed = computed(() => game.value.index + Number(answered.value))
const scoreText = computed(() => t('quiz.score', { score: game.value.score, total: game.value.questions.length }))
const announcement = computed(() => answered.value ? `${t(correct.value ? 'quiz.correct' : 'quiz.wrong')} ${t('quiz.correctMeaning', { meaning: meaning.value?.text })} ${scoreText.value}` : '')
const questionTitle = useTemplateRef<HTMLElement>('questionTitle')
const nextControl = useTemplateRef<HTMLElement>('nextControl')
const endTitle = useTemplateRef<HTMLElement>('endTitle')

useSeoMeta({
  title: () => t('quiz.title'),
  ogTitle: () => `${t('quiz.title')} · Potkalnički zapisi`,
  ogDescription: () => t('quiz.description'),
  description: () => t('quiz.description')
})

watch([meaningLocale, wordList], () => {
  replayingMissed.value = false
  game.value = newGame()
})

async function answer(optionId: string) {
  game.value = answerMeaningQuestion(game.value, optionId)
  await nextTick()
  nextControl.value?.querySelector('button')?.focus()
}

async function next() {
  game.value = advanceMeaningGame(game.value)
  await nextTick()
  ;(question.value ? questionTitle.value : endTitle.value)?.focus()
}

async function replay() {
  seed.value = (seed.value + 1) >>> 0
  replayingMissed.value = false
  game.value = newGame()
  await nextTick()
  questionTitle.value?.focus()
}

async function replayMissed() {
  seed.value = (seed.value + 1) >>> 0
  replayingMissed.value = true
  game.value = replayMissedGame(game.value, seededRandom(seed.value))
  await nextTick()
  questionTitle.value?.focus()
}
</script>

<template>
  <UContainer class="py-3 sm:py-5 lg:py-6">
    <div
      id="heritage-quiz"
      class="mx-auto grid w-full min-w-0 max-w-xl gap-3 lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-12 lg:gap-y-6"
    >
      <header class="lg:col-start-1 lg:row-start-1">
        <p class="mb-1 text-xs font-semibold text-primary">
          Kaj to znači?
        </p>
        <h1 class="text-2xl font-bold tracking-tight text-highlighted sm:text-3xl">
          {{ t('quiz.title') }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ t('quiz.description') }}
        </p>
      </header>

      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="sr-only"
      >
        {{ announcement }}
      </p>

      <div class="flex min-w-0 flex-col gap-2.5 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div
          v-if="error || status === 'idle' || status === 'pending'"
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

        <template v-else-if="question">
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>{{ t('quiz.progress', { current: game.index + 1, total: game.questions.length }) }}</span>
            <span>{{ scoreText }}</span>
          </div>
          <UProgress
            :model-value="completed"
            :max="game.questions.length"
            size="sm"
            :get-value-label="() => t('quiz.progressLabel')"
            :get-value-text="(value, max) => t('quiz.answeredProgress', { count: value, total: max })"
            :ui="{ indicator: 'motion-reduce:transition-none' }"
          />

          <section
            class="min-w-0 rounded-xl bg-default p-3 shadow-sm ring ring-default sm:p-5"
            aria-labelledby="question-word"
          >
            <div class="mb-2 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 text-center">
              <h2
                id="question-word"
                ref="questionTitle"
                tabindex="-1"
                lang="hr"
                class="max-w-full text-3xl font-bold wrap-anywhere text-highlighted outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary sm:text-4xl"
              >
                {{ question.entry.headword }}
              </h2>
              <p
                v-if="question.entry.partOfSpeech"
                class="text-xs text-muted"
                lang="hr"
              >
                {{ question.entry.partOfSpeech }}
              </p>
              <UBadge
                v-if="question.entry.status === 'placeholder'"
                :label="t('quiz.sample')"
                color="neutral"
                variant="outline"
                size="sm"
              />
            </div>

            <fieldset class="min-w-0">
              <legend class="mb-2 text-xs font-medium text-muted">
                {{ t('quiz.choose') }}
              </legend>
              <p
                v-if="question.options.length < 4"
                class="mb-2 text-xs text-muted"
              >
                {{ t('quiz.fewerOptions', { count: question.options.length }) }}
              </p>
              <div class="grid grid-cols-2 gap-2">
                <UButton
                  v-for="(option, index) in question.options"
                  :key="option.id"
                  :data-option-id="option.id"
                  :lang="option.lang"
                  :disabled="answered"
                  :color="answered && option.id === question.correctOptionId ? 'success' : answered && option.id === game.selectedOptionId ? 'error' : 'neutral'"
                  :variant="answered && (option.id === question.correctOptionId || option.id === game.selectedOptionId) ? 'subtle' : 'outline'"
                  size="lg"
                  class="min-w-0 justify-start text-start whitespace-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-100"
                  @click="answer(option.id)"
                >
                  <span
                    class="shrink-0 text-xs opacity-60"
                    aria-hidden="true"
                  >{{ index + 1 }}.</span>
                  <span class="min-w-0 wrap-anywhere">{{ option.text }}</span>
                  <UIcon
                    v-if="answered && option.id === question.correctOptionId"
                    name="i-lucide-circle-check"
                    class="size-4 shrink-0"
                  />
                  <UIcon
                    v-else-if="answered && option.id === game.selectedOptionId"
                    name="i-lucide-circle-x"
                    class="size-4 shrink-0"
                  />
                  <span
                    v-if="answered && option.id === question.correctOptionId"
                    class="sr-only"
                  >{{ t('quiz.correctOption') }}</span>
                  <span
                    v-if="answered && option.id === game.selectedOptionId"
                    class="sr-only"
                  >{{ t('quiz.yourAnswer') }}</span>
                </UButton>
              </div>
            </fieldset>

            <div
              v-if="answered"
              class="mt-3 flex min-w-0 flex-col gap-2 border-t border-default pt-3"
            >
              <UAlert
                :title="t(correct ? 'quiz.correct' : 'quiz.wrong')"
                :icon="correct ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
                :color="correct ? 'success' : 'error'"
                variant="subtle"
              />
              <div class="max-h-32 min-w-0 overflow-y-auto sm:max-h-48">
                <div class="flex flex-wrap items-baseline gap-x-2">
                  <span class="text-xs text-muted">{{ t('quiz.meaning') }}</span>
                  <span
                    class="text-lg font-bold wrap-anywhere text-highlighted"
                    :lang="meaning?.lang"
                  >
                    {{ meaning?.text }}
                  </span>
                  <span
                    v-if="meaning?.lang === 'en'"
                    class="text-xs text-muted"
                    lang="hr"
                  >
                    {{ question.entry.meaning.hr }}
                  </span>
                </div>
                <p
                  v-if="example"
                  class="mt-1 text-xs"
                >
                  <span class="mr-1 text-muted">{{ t('quiz.example') }}</span>
                  <span lang="hr"><i>{{ example.text }}</i><span
                    v-if="example.translation"
                    class="text-muted"
                  > — {{ example.translation }}</span></span>
                </p>
                <div class="mt-2">
                  <h3 class="mb-1 text-xs font-semibold text-muted">
                    {{ t('quiz.variants') }}
                  </h3>
                  <HeritageVariantList
                    :entry="question.entry"
                    :english="locale === 'en'"
                    lang="hr"
                  />
                </div>
              </div>
            </div>
          </section>

          <div
            v-if="answered"
            ref="nextControl"
            class="print:hidden"
          >
            <UButton
              :label="t(game.index + 1 === game.questions.length ? 'quiz.results' : 'quiz.next')"
              trailing-icon="i-lucide-arrow-right"
              size="xl"
              block
              @click="next"
            />
          </div>

          <!-- Only once answered: the report is about this question's word, not a way to peek. -->
          <UButton
            v-if="answered"
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
            :entry="question.entry"
          />
        </template>

        <div
          v-else
          class="flex flex-col items-center gap-3 rounded-xl bg-default p-4 text-center ring ring-default sm:p-6"
        >
          <UIcon
            :name="game.questions.length ? 'i-lucide-party-popper' : 'i-lucide-book-open'"
            class="size-8 text-primary"
          />
          <h2
            ref="endTitle"
            tabindex="-1"
            class="text-xl font-bold text-highlighted outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
          >
            {{ t(game.questions.length ? 'quiz.done' : 'quiz.emptyTitle') }}
          </h2>
          <p
            role="status"
            class="text-sm text-muted"
          >
            {{ game.questions.length ? t('quiz.result', { score: game.score, total: game.questions.length }) : t('quiz.emptyDescription') }}
          </p>
          <section
            v-if="game.questions.length"
            class="w-full min-w-0 border-t border-default pt-3 text-start"
            aria-labelledby="quiz-review-title"
            data-testid="quiz-review"
          >
            <h3
              id="quiz-review-title"
              class="text-sm font-semibold text-highlighted"
            >
              {{ t('quiz.reviewTitle') }}
            </h3>
            <p
              v-if="!missedReview.length"
              class="mt-1 text-sm text-muted"
            >
              {{ t('quiz.noMisses') }}
            </p>
            <ul
              v-else
              class="mt-1 flex flex-col gap-1.5"
            >
              <li
                v-for="item in missedReview"
                :key="item.id"
                class="flex min-w-0 flex-wrap items-baseline gap-x-2 rounded-lg bg-elevated px-2 py-1.5 text-sm"
              >
                <span
                  lang="hr"
                  class="font-semibold wrap-anywhere text-highlighted"
                >{{ item.headword }}</span>
                <span
                  :lang="item.meaning.lang"
                  class="wrap-anywhere"
                >{{ item.meaning.text }}</span>
              </li>
            </ul>
          </section>
          <div
            v-if="game.questions.length"
            class="flex flex-wrap justify-center gap-2"
          >
            <UButton
              v-if="missedReview.length"
              :label="t('quiz.replayMissed', { count: missedReview.length })"
              icon="i-lucide-rotate-ccw"
              size="lg"
              data-testid="quiz-replay-missed"
              @click="replayMissed"
            />
            <UButton
              :label="t('quiz.replay')"
              icon="i-lucide-shuffle"
              :color="missedReview.length ? 'neutral' : 'primary'"
              :variant="missedReview.length ? 'outline' : 'solid'"
              size="lg"
              data-testid="quiz-replay"
              @click="replay"
            />
          </div>
          <HeritageQuizShare
            v-if="game.questions.length && !replayingMissed"
            :results="game.results"
          />
          <HeritageChallengeShare
            v-if="game.questions.length && !replayingMissed"
            :quiz="challengeQuiz"
          />
        </div>
      </div>

      <div class="flex flex-col gap-2 lg:col-start-1 lg:row-start-2">
        <UAlert
          v-if="hasSamples"
          :title="t('quiz.sampleTitle')"
          :description="t('quiz.sampleNotice')"
          icon="i-lucide-triangle-alert"
          color="neutral"
          variant="outline"
          :ui="{ icon: 'text-warning' }"
        />
      </div>
    </div>
  </UContainer>
</template>

<style scoped>
/* Area names can be longer than a narrow phone's card. Keep the shared chips readable. */
#heritage-quiz :deep(span[title]) {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
