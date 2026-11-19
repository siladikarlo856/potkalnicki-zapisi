<script setup lang="ts">
// AnswerFeedback: what appears under a question once it is checked. A polite status region that reads as one
// sentence ("Točno. Točan odgovor: jaje. …"), with focus on its heading. Right is the green tint with a check;
// wrong and partly right are a dashed ink outline with a cross, never the error red. It never advances the round:
// the player reads, follows a link, and presses Dalje. The only motion is a short fade-in (off under reduced motion).
defineProps<{
  correct: boolean
  /** The right answer, shown in bold. Left out when the round has no single answer (matching). */
  answer?: string
  /** Replaces "Točno" / "Netočno" for a round that is not simply right or wrong ("5 od 6 točno"). */
  title?: string
  /** One sentence of why. */
  explanation?: string
  lang?: 'hr' | 'en'
  /** Extra summary for assistive tech, such as the running score. */
  srExtra?: string
}>()

const heading = useTemplateRef<HTMLElement>('heading')
defineExpose({ focus: () => heading.value?.focus() })
</script>

<template>
  <section
    role="status"
    aria-live="polite"
    class="flex min-w-0 pz-fade-in items-start gap-3 rounded-(--pz-radius-md) border-2 p-4"
    :class="correct ? 'border-success bg-(--pz-ok-bg)' : 'border-dashed border-inverted bg-default'"
    :data-state="correct ? 'right' : 'wrong'"
    data-testid="game-feedback"
  >
    <UIcon
      :name="correct ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
      class="mt-0.5 size-7 shrink-0"
      :class="correct ? 'text-success' : 'text-highlighted'"
      aria-hidden="true"
    />
    <div class="flex min-w-0 flex-1 flex-col gap-2">
      <h3
        ref="heading"
        tabindex="-1"
        class="font-display text-xl font-bold text-highlighted outline-offset-4"
        data-testid="game-feedback-heading"
      >
        {{ title ?? (correct ? 'Točno' : 'Netočno') }}
      </h3>
      <p
        v-if="answer || explanation"
        class="pz-body wrap-anywhere text-default"
        :lang="lang"
      >
        <template v-if="answer">
          Točan odgovor: <b data-testid="game-feedback-answer">{{ answer }}</b>.
        </template>
        <template v-if="explanation">
          {{ explanation }}
        </template>
      </p>
      <span
        v-if="srExtra"
        class="sr-only"
      >{{ srExtra }}</span>
      <slot />
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 print:hidden">
        <slot name="links" />
      </div>
    </div>
  </section>
</template>
