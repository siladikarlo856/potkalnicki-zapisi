<script setup lang="ts">
import { gameDefinition } from '~~/shared/utils/games/definitions'
import type { GameId, GameQuestion } from '~~/shared/utils/games/types'
import type { QuizChallengeInput } from '~~/shared/utils/challenge'
import { pzRoutes } from '~~/shared/utils/appRoutes'
import { resultShareMessage } from '~/utils/shareResult'
import { nounFor } from '~/utils/pzText'
import type { DotState } from '~/utils/questionDots'

// End screen of a round (ScreenResult): the score as a numeral over a row of squares, a one-line verdict, then
// "Izazovi prijatelje s ovom rundom" as the one primary action, "Podijeli rezultat" as a secondary that opens the
// share sheet, the misses (each with a link to its record and a correction) and the replay buttons.
// Words and answers never go into the shared text: only the headline, the squares and an invitation.
const props = defineProps<{
  gameId: GameId
  title: string
  questions: GameQuestion[]
  results: boolean[]
  /** Which questions were skipped (a skipped question is not right). */
  skipped?: boolean[]
  /** How long the round took. */
  seconds?: number
  /** The best score before this round, to say when it is beaten. */
  previousBest?: { score: number, max: number } | null
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
const definition = computed(() => gameDefinition(props.gameId))
const canChallenge = computed(() => !props.practice && definition.value.challengeable && total.value > 0)
const canShare = computed(() => !props.practice && total.value > 0)
// With a creator round the primary opens the create form in place; otherwise it goes to the challenge page.
const challengeHref = computed(() => localePath(pzRoutes.challenge))
const challengeOpen = ref(false)
const shareOpen = ref(false)
const origin = ref('')
const newBest = computed(() => {
  if (props.practice || !props.previousBest || !total.value) return false
  return correct.value / total.value > props.previousBest.score / props.previousBest.max
})
const sentence = computed(() => {
  if (!total.value) return ''
  if (correct.value === total.value) return props.previousBest === null || newBest.value ? 'Sve točno. Novi najbolji rezultat.' : 'Sve točno.'
  const missed = misses.value.length
  if (correct.value / total.value < 0.5) return 'Ovo nije lako ni onima koji su ovdje odrasli. Pročitaj zapise pa pokušaj ponovno.'
  return `${correct.value} od ${total.value} točno. ${missed} ${nounFor(missed, ['pitanje', 'pitanja'])} vrijedi ponoviti.${newBest.value ? ' Novi najbolji rezultat.' : ''}`
})
const dots = computed<DotState[]>(() => props.results.map((right, i) => props.skipped?.[i] ? 'skipped' : right ? 'right' : 'wrong'))
const { scores } = useGameScores()
const stats = computed(() => {
  const best = scores.value.best[props.gameId]
  const seconds = props.seconds ?? 0
  return [
    { value: `${correct.value}/${total.value}`, label: 'točnih' },
    { value: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, label: 'vrijeme' },
    { value: best ? `${best.score}/${best.max}` : '–', label: 'najbolji rezultat' }
  ]
})
const headline = computed(() => `${props.title} · ${correct.value}/${total.value}`)
const shareUrl = computed(() => origin.value + localePath(definition.value.catalogue?.path ?? pzRoutes.games))
const shareMessage = computed(() => resultShareMessage({
  headline: headline.value,
  results: props.results,
  invite: t('pz.share.invite'),
  url: shareUrl.value
}))
const summary = useTemplateRef<{ focus: () => void }>('summary')
defineExpose({ focus: () => summary.value?.focus() })
onMounted(() => {
  origin.value = window.location.origin
})
</script>

<template>
  <div
    class="flex flex-col gap-6"
    data-testid="game-result"
  >
    <ResultSummary
      ref="summary"
      :caption="`${title} · rezultat`"
      :correct="correct"
      :total="total"
      :sentence="sentence"
      :states="dots"
      :stats="stats"
    />

    <div class="flex flex-col gap-3">
      <UButton
        :label="'Igraj ponovno'"
        icon="i-lucide-shuffle"
        size="xl"
        color="primary"
        block
        data-testid="game-replay"
        @click="emit('restart')"
      />
      <template v-if="canChallenge">
        <UButton
          v-if="quizPayload"
          :label="t('pz.play.challengeFriends')"
          icon="i-lucide-flag"
          color="neutral"
          variant="outline"
          size="lg"
          block
          :aria-expanded="challengeOpen"
          data-testid="game-make-challenge"
          @click="challengeOpen = !challengeOpen"
        />
        <UButton
          v-else
          :to="challengeHref"
          :label="t('pz.play.challengeFriends')"
          icon="i-lucide-flag"
          color="neutral"
          variant="outline"
          size="lg"
          block
          data-testid="game-make-challenge"
        />
        <HeritageChallengeShare
          v-if="quizPayload && challengeOpen"
          :quiz="quizPayload"
          :score="correct"
          :total="total"
        />
      </template>
      <UButton
        v-if="canShare"
        :label="t('pz.share.resultTitle')"
        icon="i-lucide-share-2"
        color="neutral"
        variant="outline"
        size="lg"
        block
        class="print:hidden"
        data-testid="result-share-open"
        @click="shareOpen = true"
      />
    </div>

    <section
      class="flex min-w-0 flex-col gap-4"
      aria-labelledby="game-misses-title"
      data-testid="game-misses"
    >
      <h2
        id="game-misses-title"
        class="pz-h2 text-highlighted"
      >
        Ponovi i pročitaj
      </h2>
      <p
        v-if="!misses.length"
        class="pz-body text-muted"
      >
        {{ t('pz.play.noMisses') }}
      </p>
      <ul
        v-else
        class="m-0 flex list-none flex-col overflow-hidden rounded-(--pz-radius-lg) border border-default bg-default p-0"
      >
        <li
          v-for="question in misses"
          :key="question.id"
          class="flex min-w-0 flex-col gap-1 border-t border-default px-4 py-3 first:border-t-0"
          data-testid="game-miss"
        >
          <span
            class="font-serif text-[17px]/[22px] font-semibold wrap-anywhere text-highlighted"
            lang="hr"
          >{{ question.prompt[lang] }}</span>
          <span
            class="pz-body-sm wrap-anywhere text-muted"
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
      <div class="grid gap-2 sm:grid-cols-2">
        <UButton
          v-if="misses.length"
          :label="t('pz.play.replayMissed', { count: misses.length })"
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="outline"
          size="lg"
          block
          data-testid="game-replay-missed"
          @click="emit('replay-missed')"
        />
      </div>
    </section>

    <PzShareSheet
      v-if="canShare"
      v-model:open="shareOpen"
      :title="t('pz.share.resultTitle')"
      :context="t('pz.share.resultContext')"
      :message="shareMessage"
      :url="shareUrl"
      preview
      prefix="result"
    />
  </div>
</template>
