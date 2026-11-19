<script setup lang="ts">
// A count that is a link: "7 priloga čeka pregled" is the link's name, with one small line under it. `attention` outlines
// the most urgent card in ink. Link to the filtered list, never to nothing.
defineProps<{
  to: string | { path: string, query?: Record<string, string> }
  /** The number, shown large. */
  count: number | string
  /** The words after the number: "priloga čeka pregled". */
  label: string
  detail?: string
  attention?: boolean
}>()
</script>

<template>
  <NuxtLink
    :to="to"
    class="flex flex-col gap-1 rounded-lg bg-default p-4 text-default no-underline hover:bg-elevated"
    :class="attention ? 'border-2 border-inverted' : 'border border-default'"
    data-testid="admin-dashboard-card"
    :data-attention="attention ? 'true' : undefined"
  >
    <span class="pz-numeral text-highlighted"><span aria-hidden="true">{{ count }}</span></span>
    <span class="text-base font-bold"><span class="sr-only">{{ count }} </span>{{ label }}</span>
    <span
      v-if="detail"
      class="pz-caption text-muted"
    >{{ detail }}</span>
  </NuxtLink>
</template>
