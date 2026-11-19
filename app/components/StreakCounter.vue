<script setup lang="ts">
import { streakLabel } from '~/utils/dailyClues'

// A quiet reward for coming back to the word of the day: the text carries it, the flame is decoration.
// The ochre card is the only place it sits on a coloured ground; there the pill takes the accent-well fill.
defineProps<{ days: number, onAccent?: boolean }>()
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full py-1 pe-3 ps-2 text-sm font-bold whitespace-nowrap tabular-nums"
    :class="onAccent ? 'bg-(--pz-accent-well) text-(--pz-on-accent)' : 'bg-elevated text-highlighted'"
    data-testid="streak-counter"
  >
    <UIcon
      name="i-lucide-flame"
      class="size-[18px]"
      aria-hidden="true"
    />{{ streakLabel(days) }}
  </span>
</template>
