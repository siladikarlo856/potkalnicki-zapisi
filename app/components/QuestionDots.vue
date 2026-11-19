<script setup lang="ts">
// QuestionDots: one square per question. Right is a check on the green tint, wrong a cross on a dashed outline,
// skipped a dash, the current question a heavier outline. Each carries hidden text, so colour is never the only cue.
import type { DotState } from '~/utils/questionDots'

const props = defineProps<{
  states: readonly DotState[]
  /** Zero-based index of the question being answered. */
  current?: number
  large?: boolean
}>()

const words: Record<DotState, string> = { right: 'točno', wrong: 'netočno', skipped: 'preskočeno', upcoming: 'još nije' }
const icons: Partial<Record<DotState, string>> = { right: 'i-lucide-check', wrong: 'i-lucide-x', skipped: 'i-lucide-minus' }

const dots = computed(() => props.states.map((state, index) => ({ state, index, current: index === props.current })))
</script>

<template>
  <ol
    class="m-0 flex list-none flex-wrap gap-1.5 p-0"
    data-testid="question-dots"
  >
    <li
      v-for="dot in dots"
      :key="dot.index"
      class="grid place-items-center rounded-[7px] text-xs font-bold tabular-nums"
      :class="[
        large ? 'size-8' : 'size-[26px]',
        dot.state === 'right' ? 'border-[1.5px] border-success bg-(--pz-ok-bg) text-success'
        : dot.state === 'wrong' ? 'border-2 border-dashed border-inverted text-highlighted'
          : dot.state === 'skipped' ? 'border-[1.5px] border-accented bg-elevated text-highlighted'
            : dot.current ? 'border-2 border-inverted text-highlighted' : 'border-[1.5px] border-accented text-muted'
      ]"
      :aria-current="dot.current ? 'step' : undefined"
      :data-state="dot.state"
    >
      <UIcon
        v-if="icons[dot.state]"
        :name="icons[dot.state]!"
        class="size-[15px]"
        aria-hidden="true"
      />
      <span
        v-else
        aria-hidden="true"
      >{{ dot.index + 1 }}</span>
      <span class="sr-only">{{ dot.index + 1 }}. pitanje: {{ words[dot.state] }}</span>
    </li>
  </ol>
</template>
