<script setup lang="ts">
import { slotsLabel } from '~/utils/dailyClues'

// The length of the word of the day and the letters given so far. Display only: one image with one sentence, the
// slots themselves are not read. On the ochre card the slots take the accent-well fill.
const props = defineProps<{
  /** One entry per character: the letter when revealed, an empty string when not. */
  letters: readonly string[]
  onAccent?: boolean
}>()

const label = computed(() => slotsLabel(props.letters))
</script>

<template>
  <div
    class="flex flex-wrap gap-[5px]"
    role="img"
    :aria-label="label"
    data-testid="letter-slots"
  >
    <template
      v-for="(letter, index) in letters"
      :key="index"
    >
      <span
        v-if="letter === ' ' || letter === '-'"
        class="grid h-[42px] w-3 place-items-center font-bold"
        aria-hidden="true"
      >{{ letter === '-' ? '-' : '' }}</span>
      <span
        v-else
        class="grid h-[42px] w-9 place-items-center rounded-(--pz-radius-sm) font-display text-[1.375rem]/none font-bold lowercase"
        :class="onAccent ? 'bg-(--pz-accent-well) text-(--pz-on-accent)' : 'bg-elevated text-highlighted'"
        aria-hidden="true"
        data-testid="letter-slot"
      >{{ letter }}</span>
    </template>
  </div>
</template>
