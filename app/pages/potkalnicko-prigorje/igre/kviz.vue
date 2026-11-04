<script setup lang="ts">
import { mulberry32 } from '~~/shared/utils/games/rng'
import { generateQuestions } from '~~/shared/utils/games/questions'
import type { GameQuestion } from '~~/shared/utils/games/types'
import { QUIZ_LENGTH } from '~/utils/multipleChoice'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { locale, t } = useI18n()
const { pool, status, error, refresh } = useCardPool()
// The word entries carry the variants and examples the feedback shows; the questions come from the card pool.
const { words } = useHeritage()
const { totals } = useProgress()
// Nuxt carries the seed to the client, keeping server rendering and hydration identical.
const seed = useState('heritage-quiz-seed', () => Math.floor(Math.random() * 4294967296))
const questions = shallowRef<GameQuestion[]>([])
const variantOpen = ref(false)
const wordsById = computed(() => new Map(words.value.map(word => [word.id, word])))
const loading = computed(() => !error.value && (status.value === 'idle' || status.value === 'pending'))

// `znacenje` at Srednje starts at once, as the quiz always has: no start screen.
function newRound() {
  return generateQuestions('znacenje', pool.value, {
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
        <p class="mt-1 text-xs text-muted">
          {{ t('game.progressCount', { count: totals.known + totals.missed }) }}
        </p>
      </header>

      <div class="flex min-w-0 flex-col gap-2.5 lg:col-start-2 lg:row-span-2 lg:row-start-1">
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
          v-else-if="!questions.length"
          class="flex flex-col items-center gap-3 rounded-xl bg-default p-4 text-center ring ring-default sm:p-6"
        >
          <UIcon
            name="i-lucide-book-open"
            class="size-8 text-primary"
          />
          <h2 class="text-xl font-bold text-highlighted">
            {{ t('quiz.emptyTitle') }}
          </h2>
          <p
            role="status"
            class="text-sm text-muted"
          >
            {{ t('quiz.emptyDescription') }}
          </p>
        </div>

        <GamesShell
          v-else
          game-id="znacenje"
          title="Kaj to znači?"
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
