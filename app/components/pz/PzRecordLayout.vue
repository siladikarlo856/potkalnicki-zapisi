<script setup lang="ts">
// One markup order that reads correctly on a phone and becomes two columns on desktop by grid placement alone:
// media, facts, body, extras. Never reorder with `order` or duplicate panels per width.
// Desktop: 1fr and 352px, 48px apart; the extras stay in view while the text scrolls.
defineProps<{
  /** No gallery: the text starts on row one. */
  noMedia?: boolean
}>()
</script>

<template>
  <div
    class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-x-12"
    data-testid="record-layout"
    :data-variant="noMedia ? 'nomedia' : 'media'"
  >
    <div
      v-if="!noMedia"
      class="min-w-0 lg:col-start-1 lg:row-start-1"
      data-testid="record-media"
    >
      <slot name="media" />
    </div>
    <div
      class="min-w-0 lg:col-start-2 lg:row-start-1"
      data-testid="record-facts"
    >
      <slot name="facts" />
    </div>
    <div
      class="min-w-0 lg:col-start-1"
      :class="noMedia ? 'lg:row-start-1 lg:row-span-2' : 'lg:row-start-2'"
      data-testid="record-body"
    >
      <slot name="body" />
    </div>
    <div
      class="min-w-0 sm:grid sm:grid-cols-2 sm:items-start sm:gap-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-2 lg:flex lg:flex-col lg:gap-4 lg:self-start"
      :class="noMedia && 'lg:row-start-2'"
      data-testid="record-extras"
    >
      <slot name="extras" />
    </div>
  </div>
</template>
