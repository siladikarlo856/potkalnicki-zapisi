<script setup lang="ts">
import type { CardPool, PoolItem, PoolPerson, PoolPlace, PoolWord } from '~~/shared/utils/learn/types'
import type { GameQuestion } from '~~/shared/utils/games/types'

const props = defineProps<{
  card: PoolWord | PoolPlace | PoolItem | PoolPerson
  pool: CardPool
  question: GameQuestion
}>()

const emit = defineEmits<{ answer: [correct: boolean] }>()
const { t } = useI18n()

const selected = ref<number | null>(null)

function choose(index: number) {
  if (selected.value !== null) return
  selected.value = index
  emit('answer', index === props.question.correct)
}
</script>

<template>
  <div
    class="mx-auto flex max-w-md flex-col gap-3"
    data-testid="learn-review-card"
  >
    <div class="rounded-xl bg-default p-4 text-center ring ring-default sm:p-5">
      <p
        v-if="card.kind === 'word'"
        class="text-4xl font-bold tracking-tight text-highlighted sm:text-5xl"
      >
        {{ card.headword }}
      </p>
      <p
        v-else
        class="text-2xl font-bold tracking-tight text-highlighted sm:text-3xl"
      >
        {{ card.name }}
      </p>
      <p
        v-if="card.kind === 'word' && card.partOfSpeech"
        class="mt-2 text-sm text-muted"
      >
        {{ card.partOfSpeech }}
      </p>
    </div>

    <p
      id="learn-review-prompt"
      class="text-sm font-semibold text-highlighted"
    >
      {{ t('pz.learn.reviewPrompt') }}
    </p>

    <GamesOptions
      :question="question"
      :selected="selected"
      labelledby="learn-review-prompt"
      @select="choose"
    />
  </div>
</template>
