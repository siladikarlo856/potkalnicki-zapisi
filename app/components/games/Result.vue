<script setup lang="ts">
import { GAME_CATALOGUE } from '~~/shared/utils/games/catalogue'
import type { GameId, GameQuestion } from '~~/shared/utils/games/types'
import type { QuizChallengeInput } from '~~/shared/utils/challenge'
import { pzRoutes } from '~~/shared/utils/appRoutes'

// End screen of a round: the score, the misses (with a link to the record and a correction), replay,
// "make a challenge from this" and a quiet share. Words and answers never go into the shared text.
const props = defineProps<{
  gameId: GameId
  title: string
  questions: GameQuestion[]
  results: boolean[]
  /** A round of only the missed questions is practice: it is neither shared nor turned into a challenge. */
  practice?: boolean
  /** Only `znacenje`: keeps the creator's own round ("Moja runda"). */
  quizPayload?: QuizChallengeInput | null
}>()
const emit = defineEmits<{ 'restart': [], 'replay-missed': [] }>()
const { t, locale } = useI18n()
const localePath = useLocalePath()

const total = computed(() => props.questions.length)
const correct = computed(() => props.results.filter(Boolean).length)
const lang = computed(() => locale.value === 'en' ? 'en' : 'hr')
const misses = computed(() => props.questions.filter((_, index) => props.results[index] === false))
const entry = computed(() => GAME_CATALOGUE.find(game => game.id === props.gameId))
const canChallenge = computed(() => !props.practice && Boolean(entry.value?.challengeable) && total.value > 0)
// Before WP13 adds the create flow, other games link to the challenge page.
const challengeHref = computed(() => localePath(pzRoutes.challenge))
const headline = computed(() => `${props.title} ${correct.value}/${total.value}`)
const heading = useTemplateRef<HTMLElement>('heading')
defineExpose({ focus: () => heading.value?.focus() })
</script>

<template>
  <div
    class="flex flex-col items-center gap-3 rounded-xl bg-default p-4 text-center ring ring-default sm:p-6"
    data-testid="game-result"
  >
    <UIcon
      :name="total ? 'i-lucide-party-popper' : 'i-lucide-book-open'"
      class="size-8 text-primary"
    />
    <h2
      ref="heading"
      tabindex="-1"
      class="text-xl font-bold text-highlighted outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
    >
      {{ t('pz.play.done') }}
    </h2>
    <p
      role="status"
      class="text-lg font-semibold text-highlighted"
      data-testid="game-result-score"
    >
      {{ t('pz.play.resultOf', { correct, n: total }) }}
    </p>

    <section
      class="w-full min-w-0 border-t border-default pt-3 text-start"
      aria-labelledby="game-misses-title"
      data-testid="game-misses"
    >
      <h3
        id="game-misses-title"
        class="text-sm font-semibold text-highlighted"
      >
        {{ t('pz.play.missesTitle') }}
      </h3>
      <p
        v-if="!misses.length"
        class="mt-1 text-sm text-muted"
      >
        {{ t('pz.play.noMisses') }}
      </p>
      <ul
        v-else
        class="mt-1 flex flex-col gap-2"
      >
        <li
          v-for="question in misses"
          :key="question.id"
          class="flex min-w-0 flex-col gap-1 rounded-lg bg-elevated px-2.5 py-2 text-sm"
          data-testid="game-miss"
        >
          <span
            class="font-semibold wrap-anywhere text-highlighted"
            lang="hr"
          >{{ question.prompt[lang] }}</span>
          <span
            class="wrap-anywhere"
            lang="hr"
          >{{ t('pz.play.correctAnswer', { answer: question.options[question.correct]![lang] }) }}</span>
          <span class="flex flex-wrap items-center gap-x-4 gap-y-0.5">
            <UButton
              v-if="question.archivePath"
              :to="localePath(question.archivePath)"
              :label="t('pz.play.openRecord')"
              trailing-icon="i-lucide-arrow-right"
              color="neutral"
              variant="link"
              size="sm"
              class="px-0"
            />
            <GamesCorrection :card="question.card" />
          </span>
        </li>
      </ul>
    </section>

    <div class="flex flex-wrap justify-center gap-2">
      <UButton
        v-if="misses.length"
        :label="t('pz.play.replayMissed', { count: misses.length })"
        icon="i-lucide-rotate-ccw"
        size="lg"
        data-testid="game-replay-missed"
        @click="emit('replay-missed')"
      />
      <UButton
        :label="t('pz.play.again')"
        icon="i-lucide-shuffle"
        :color="misses.length ? 'neutral' : 'primary'"
        :variant="misses.length ? 'outline' : 'solid'"
        size="lg"
        data-testid="game-replay"
        @click="emit('restart')"
      />
    </div>

    <template v-if="canChallenge">
      <HeritageChallengeShare
        v-if="quizPayload"
        :quiz="quizPayload"
        :score="correct"
        :total="total"
      />
      <UButton
        v-else
        :to="challengeHref"
        :label="t('pz.play.makeChallenge')"
        icon="i-lucide-swords"
        color="neutral"
        variant="outline"
        size="lg"
        data-testid="game-make-challenge"
      />
    </template>

    <HeritageQuizShare
      v-if="!practice && total"
      :results="results"
      :headline="headline"
      :path="entry?.path ?? pzRoutes.games"
    />
  </div>
</template>
