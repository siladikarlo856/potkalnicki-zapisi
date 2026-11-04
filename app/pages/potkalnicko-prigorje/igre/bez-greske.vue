<script setup lang="ts">
import { BEZ_GRESKE_SCORE_MAX, nextBezGreskeQuestion } from '~~/shared/utils/games/bezGreske'
import { mulberry32 } from '~~/shared/utils/games/rng'
import type { CardKey } from '~~/shared/utils/learn/types'
import type { GameQuestion } from '~~/shared/utils/games/types'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t, locale } = useI18n()
const lang = computed(() => locale.value === 'en' ? 'en' : 'hr')
const { pool, status, error, refresh } = useCardPool()
const { recordAnswer } = useProgress()
const { recordBest, best } = useGameScores()

const seed = useState('bez-greske-seed', () => Math.floor(Math.random() * 4294967296))
const streak = ref(0)
const question = shallowRef<GameQuestion | null>(null)
const selected = ref<number | null>(null)
const answered = ref(false)
const finished = ref(false)
const used = ref<Set<CardKey>>(new Set())

const loading = computed(() => !error.value && (status.value === 'idle' || status.value === 'pending'))
const bestStreak = computed(() => best('bez-greske'))

function drawQuestion() {
  const rng = mulberry32((seed.value + streak.value) >>> 0)
  question.value = nextBezGreskeQuestion(pool.value, rng, used.value)
}

watch(() => pool.value.cards, () => {
  if (!finished.value && !question.value) drawQuestion()
}, { immediate: true })

function restart() {
  seed.value = (seed.value + 1) >>> 0
  streak.value = 0
  used.value = new Set()
  selected.value = null
  answered.value = false
  finished.value = false
  drawQuestion()
}

async function pick(option: number) {
  const current = question.value
  if (!current || answered.value || finished.value) return
  selected.value = option
  answered.value = true
  const right = option === current.correct
  recordAnswer(current.card, right)
  if (right) {
    used.value = new Set([...used.value, current.card])
    streak.value += 1
    await nextTick()
    selected.value = null
    answered.value = false
    drawQuestion()
    if (!question.value) finished.value = true
    return
  }
  finished.value = true
  recordBest('bez-greske', streak.value, BEZ_GRESKE_SCORE_MAX)
}

const announcement = computed(() => {
  const current = question.value
  if (!current || !answered.value || !finished.value) return ''
  return t('pz.play.wrong')
})

useSeoMeta({
  title: () => t('pz.play.bezTitle'),
  ogTitle: () => `${t('pz.play.bezTitle')} · Potkalnički zapisi`,
  description: () => t('pz.play.bezDescription')
})
</script>

<template>
  <UContainer class="py-3 sm:py-5 lg:py-6">
    <div
      class="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-3"
      data-testid="bez-greske"
    >
      <p
        role="status"
        aria-live="polite"
        class="sr-only"
      >
        {{ announcement }}
      </p>

      <header>
        <p class="mb-1 text-xs font-semibold text-primary">
          {{ t('pz.play.bezTitle') }}
        </p>
        <h1 class="text-2xl font-bold tracking-tight text-highlighted sm:text-3xl">
          {{ t('pz.play.bezDescription') }}
        </h1>
        <p
          class="mt-2 text-sm font-semibold text-highlighted"
          data-testid="bez-streak"
        >
          {{ t('pz.play.bezStreak', { n: streak }) }}
        </p>
        <p
          v-if="bestStreak"
          class="text-xs text-muted"
        >
          {{ t('pz.play.bezBestStreak', { n: bestStreak.score }) }}
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

      <template v-else-if="question && !finished">
        <section
          class="min-w-0 rounded-xl bg-default p-3 shadow-sm ring ring-default sm:p-5"
          aria-labelledby="bez-question"
        >
          <h2
            id="bez-question"
            :lang="lang"
            class="mb-3 text-center text-2xl font-bold wrap-anywhere text-highlighted sm:text-3xl"
            data-testid="bez-prompt"
          >
            {{ question.prompt[lang] }}
          </h2>
          <GamesOptions
            :question="question"
            :selected="selected"
            :answered="answered"
            labelledby="bez-question"
            @select="pick"
          />
        </section>
      </template>

      <section
        v-else-if="finished"
        class="rounded-xl bg-default p-4 ring ring-default"
        data-testid="bez-result"
      >
        <h2 class="text-lg font-bold text-highlighted">
          {{ t('pz.play.done') }}
        </h2>
        <p class="mt-2 text-base text-highlighted">
          {{ t('pz.play.bezStreak', { n: streak }) }}
        </p>
        <UButton
          class="mt-4 print:hidden"
          :label="t('pz.play.bezAgain')"
          size="lg"
          block
          @click="restart"
        />
      </section>
    </div>
  </UContainer>
</template>
