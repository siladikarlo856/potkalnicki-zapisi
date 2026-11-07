<script setup lang="ts">
import { resultCounts } from '~/utils/shareResult'

// The spoiler-free result: the score, plus a row of squares that tells friends how it went without revealing an
// answer. One 20px square per question in question order, with a text label for the counts. The stitch rule closes it.
const props = defineProps<{
  /** The line above the score, such as "Kak se veli? · gotovo". */
  caption?: string
  results: readonly boolean[]
}>()
const { t } = useI18n()
const heading = useTemplateRef<HTMLElement>('heading')
defineExpose({ focus: () => heading.value?.focus() })
const counts = computed(() => resultCounts(props.results))
</script>

<template>
  <section
    class="flex flex-col items-center gap-4 pt-2 text-center"
    data-testid="pz-share-result"
  >
    <h2
      v-if="caption"
      ref="heading"
      tabindex="-1"
      class="pz-overline text-muted outline-offset-4"
      data-testid="game-result-heading"
    >
      {{ caption }}
    </h2>
    <p
      class="pz-numeral text-[56px]/[60px] text-highlighted"
      data-testid="game-result-score"
    >
      {{ t('pz.play.scoreOf', { correct: counts.ok, n: results.length }) }}
    </p>
    <span
      v-if="results.length"
      role="img"
      :aria-label="t('pz.play.progressSummary', counts)"
      class="inline-flex flex-wrap justify-center gap-1"
      data-testid="pz-squares"
    >
      <span
        v-for="(right, index) in results"
        :key="index"
        class="size-5 rounded-(--pz-radius-sm)"
        :class="right ? 'bg-success' : 'bg-error'"
        :data-correct="right"
      />
    </span>
    <slot />
    <PzStitch />
  </section>
</template>
