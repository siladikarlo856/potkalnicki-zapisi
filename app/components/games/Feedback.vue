<script setup lang="ts">
// AnswerFeedback: what appears under a question once it is answered. A status region that reads as one sentence
// ("Točno! Točan odgovor: jaje. …"), with focus on its heading. It never advances the round: the player reads,
// follows a link, and presses Dalje. No sound, no shake; the only motion is a 150ms fade-in (off under reduced motion).
defineProps<{
  correct: boolean
  /** The right answer, shown in bold. Left out when the round has no single answer (matching). */
  answer?: string
  /** Replaces "Točno!" / "Nije točno." for a round that is not right or wrong (matching). */
  title?: string
  /** One sentence of why. */
  explanation?: string
  lang?: 'hr' | 'en'
  /** Extra summary for assistive tech, such as the running score. */
  srExtra?: string
}>()

const { t } = useI18n()
const heading = useTemplateRef<HTMLElement>('heading')
defineExpose({ focus: () => heading.value?.focus() })
</script>

<template>
  <section
    role="status"
    aria-live="polite"
    class="flex min-w-0 pz-fade-in flex-col gap-3 rounded-(--pz-radius-lg) border p-4"
    :class="correct ? 'border-success bg-(--pz-success-soft)' : 'border-error bg-(--pz-error-soft)'"
    data-testid="game-feedback"
  >
    <h3
      ref="heading"
      tabindex="-1"
      class="flex items-center gap-2 text-xl font-semibold outline-offset-4"
      :class="correct ? 'text-success' : 'text-error'"
      data-testid="game-feedback-heading"
    >
      <span
        class="grid size-7 shrink-0 place-items-center rounded-full text-inverted"
        :class="correct ? 'bg-success' : 'bg-error'"
        aria-hidden="true"
      >
        <UIcon
          :name="correct ? 'i-lucide-check' : 'i-lucide-x'"
          class="size-[18px]"
        />
      </span>
      {{ title ?? t(correct ? 'pz.play.right' : 'pz.play.wrong') }}
    </h3>
    <p
      v-if="answer || explanation"
      class="pz-body wrap-anywhere text-default"
      :lang="lang"
    >
      <template v-if="answer">
        {{ t('pz.play.correctAnswerLabel') }} <b data-testid="game-feedback-answer">{{ answer }}</b>.
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
  </section>
</template>
