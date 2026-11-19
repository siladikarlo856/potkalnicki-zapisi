<script setup lang="ts">
// Card: holds one topic, separated from the ground by a line, never a shadow. Never a link itself (put links
// inside; a whole-card link is PzRecordCard or PzTile). With a `title` it is a <section> labelled by that title.
// Slots: `head-end` (a small link at the right of the head), `media` (full-bleed map or image on top), default.
const props = withDefaults(defineProps<{
  title?: string
  sub?: string
  variant?: 'default' | 'subtle' | 'flush'
}>(), { variant: 'default' })

const titleId = useId()
const slots = useSlots()
const hasHead = computed(() => !!props.title || !!props.sub || !!slots['head-end'])
</script>

<template>
  <UCard
    :as="title ? 'section' : 'div'"
    variant="outline"
    :aria-labelledby="title ? titleId : undefined"
    :class="variant === 'subtle' ? 'bg-elevated' : 'bg-default'"
    :ui="{ root: 'overflow-hidden rounded-lg ring-0 border border-default shadow-none', body: variant === 'flush' ? 'p-0 sm:p-0' : 'p-4 sm:p-5' }"
    data-testid="pz-card"
    :data-variant="variant"
  >
    <div
      v-if="$slots.media"
      :class="variant === 'flush' ? '' : '-mx-4 -mt-4 mb-4 sm:-mx-5 sm:-mt-5 sm:mb-5'"
    >
      <slot name="media" />
    </div>
    <div
      v-if="hasHead"
      class="mb-3 flex items-baseline justify-between gap-3"
    >
      <div class="min-w-0">
        <h2
          v-if="title"
          :id="titleId"
          class="pz-h3 text-highlighted"
        >
          {{ title }}
        </h2>
        <p
          v-if="sub"
          class="text-sm text-muted"
        >
          {{ sub }}
        </p>
      </div>
      <div
        v-if="$slots['head-end']"
        class="shrink-0 text-sm"
      >
        <slot name="head-end" />
      </div>
    </div>
    <slot />
  </UCard>
</template>
