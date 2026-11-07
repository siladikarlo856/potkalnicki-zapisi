<script setup lang="ts">
import type { CardPool, PoolItem, PoolPerson, PoolPlace, PoolWord } from '~~/shared/utils/learn/types'
import type { GameQuestion } from '~~/shared/utils/games/types'

// A due card in a learn session, asked as multiple choice. It uses the game kit: AnswerOption, AnswerFeedback and an
// explicit Dalje. The answer is reported as soon as it is picked (so progress is saved), and the session moves on only
// when the player presses Dalje.
const props = defineProps<{
  card: PoolWord | PoolPlace | PoolItem | PoolPerson
  pool: CardPool
  question: GameQuestion
  /** The last card of the session: Dalje reads "Pogledaj rezultat". */
  last?: boolean
}>()

const emit = defineEmits<{ answer: [correct: boolean], next: [] }>()
const { t, locale } = useI18n()
const localePath = useLocalePath()

const lang = computed(() => locale.value === 'en' ? 'en' : 'hr')
const selected = ref<number | null>(null)
const answered = computed(() => selected.value !== null)
const correct = computed(() => selected.value === props.question.correct)
const feedback = useTemplateRef<{ focus: () => void }>('feedback')
const kindLabel = computed(() => t(`pz.learn.kind${{ word: 'Word', place: 'Place', item: 'Item', person: 'Person' }[props.card.kind]}`))
const name = computed(() => props.card.kind === 'word' ? props.card.headword : props.card.name)

async function choose(index: number) {
  if (selected.value !== null) return
  selected.value = index
  emit('answer', index === props.question.correct)
  await nextTick()
  feedback.value?.focus()
}
</script>

<template>
  <div
    class="flex min-w-0 flex-col gap-3"
    data-testid="learn-review-card"
  >
    <section class="flex min-w-0 flex-col items-center gap-1 rounded-(--pz-radius-lg) border border-accented bg-(--pz-wheat) p-5 text-center text-default">
      <span class="pz-overline">{{ kindLabel }}</span>
      <p
        class="pz-headword wrap-anywhere text-highlighted"
        lang="hr"
      >
        {{ name }}
      </p>
      <p
        v-if="card.kind === 'word' && card.partOfSpeech"
        class="pz-body-sm"
      >
        {{ card.partOfSpeech }}
      </p>
    </section>

    <section
      class="min-w-0 rounded-(--pz-radius-lg) border border-default bg-default p-4"
      aria-labelledby="learn-review-prompt"
    >
      <h2
        id="learn-review-prompt"
        tabindex="-1"
        class="pz-h3 mb-3 text-highlighted outline-offset-4"
      >
        {{ t('pz.learn.reviewPrompt') }}
      </h2>
      <GamesOptions
        :question="question"
        :selected="selected"
        labelledby="learn-review-prompt"
        @select="choose"
      />
    </section>

    <GamesFeedback
      v-if="answered"
      ref="feedback"
      :correct="correct"
      :answer="question.options[question.correct]![lang]"
      :explanation="question.explanation[lang]"
      :lang="lang"
    >
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
      :last="last"
      @next="emit('next')"
    />
  </div>
</template>
