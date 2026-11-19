<script setup lang="ts">
import type { DotState } from '~/utils/questionDots'

// ResultSummary: closes a round with the number, one sentence that fits the result and never scolds, a dot per
// question and the facts that matter. The score has a hidden prefix, a new best is said in words. No confetti.
defineProps<{
  /** The overline: "Kviz riječi · rezultat". */
  caption: string
  correct: number
  total: number
  sentence?: string
  states: readonly DotState[]
  stats: readonly { value: string, label: string }[]
}>()

const heading = useTemplateRef<HTMLElement>('heading')
defineExpose({ focus: () => heading.value?.focus() })
</script>

<template>
  <section
    class="flex flex-col items-center gap-4 text-center"
    data-testid="result-summary"
  >
    <h2
      ref="heading"
      tabindex="-1"
      class="pz-overline text-muted outline-offset-4"
      data-testid="game-result-heading"
    >
      {{ caption }}
    </h2>
    <p
      class="font-display text-[clamp(3.5rem,18vw,5.5rem)] leading-none font-extrabold tracking-tight text-highlighted tabular-nums"
      data-testid="game-result-score"
    >
      <span class="sr-only">Rezultat: </span>{{ correct }}<small class="text-[.45em] font-bold text-muted">/{{ total }}</small>
    </p>
    <p
      v-if="sentence"
      class="pz-lead text-default"
      data-testid="game-result-verdict"
    >
      {{ sentence }}
    </p>
    <QuestionDots
      :states="states"
      large
      class="justify-center"
    />
    <dl
      class="m-0 grid w-full grid-cols-3 gap-2"
      data-testid="result-stats"
    >
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="flex flex-col rounded-(--pz-radius-md) bg-elevated px-2 py-3"
      >
        <dt class="order-2 text-xs text-muted">
          {{ stat.label }}
        </dt>
        <dd class="m-0 font-display text-xl leading-tight font-bold text-highlighted tabular-nums">
          {{ stat.value }}
        </dd>
      </div>
    </dl>
  </section>
</template>
