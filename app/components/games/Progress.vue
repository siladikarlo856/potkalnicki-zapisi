<script setup lang="ts">
import { pzRoutes } from '~~/shared/utils/appRoutes'

// GameProgress: the top row of a game. Exit, a text position ("Pitanje 3 od 10") over a UProgress bar, and the
// score chip. The text label is the main cue; the bar and the "3 točno, 1 netočno" summary back it up.
const props = defineProps<{
  /** 1-based position of the current question. */
  current: number
  total: number
  /** Answered questions: true for right, false for wrong. */
  results: boolean[]
  score: number
  /** Where the exit link goes; defaults to the games hub. */
  exitTo?: string
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const right = computed(() => props.results.filter(Boolean).length)
const wrong = computed(() => props.results.length - right.value)
</script>

<template>
  <div
    class="grid grid-cols-[var(--pz-tap-min)_minmax(0,1fr)_auto] items-center gap-2"
    data-testid="game-progress-row"
  >
    <UButton
      :to="exitTo ?? localePath(pzRoutes.games)"
      icon="i-lucide-x"
      color="neutral"
      variant="ghost"
      class="size-(--pz-tap-min) justify-center"
      :aria-label="t('pz.play.exitGame')"
      data-testid="game-exit"
    />
    <div class="flex min-w-0 flex-col gap-1.5">
      <span
        class="pz-label text-default"
        data-testid="game-progress"
      >{{ t('pz.play.questionOf', { i: current, n: total }) }}</span>
      <UProgress
        :model-value="results.length"
        :max="total"
        size="sm"
        :get-value-label="() => t('pz.play.progressLabel')"
        :get-value-text="(value, max) => t('pz.play.answeredProgress', { count: value, total: max })"
        :ui="{ indicator: 'motion-reduce:transition-none' }"
      />
      <span class="sr-only">{{ t('pz.play.progressSummary', { ok: right, no: wrong }) }}</span>
    </div>
    <span
      class="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-accented bg-muted px-3 py-1 text-sm font-semibold text-default tabular-nums"
      data-testid="game-score"
    >
      <UIcon
        name="i-lucide-trophy"
        class="size-4 text-primary"
      />
      <span class="sr-only">{{ t('pz.play.scoreLabel') }}:</span>
      {{ score }}
    </span>
  </div>
</template>
