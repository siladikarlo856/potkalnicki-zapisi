<script setup lang="ts">
defineProps<{ title: string, overline?: string, lead?: string, meta?: string }>()
</script>

<template>
  <header class="mb-8 flex flex-col gap-2">
    <div class="flex items-center justify-between gap-3">
      <slot name="before" /><slot name="actions" />
    </div>
    <p
      v-if="overline"
      class="pz-overline text-muted"
    >
      {{ overline }}
    </p>
    <h1 class="pz-h1 wrap-anywhere text-highlighted">
      {{ title }}
    </h1>
    <p
      v-if="meta"
      class="pz-body-sm text-muted"
    >
      {{ meta }}
    </p>
    <p
      v-if="lead"
      class="pz-lead text-toned"
    >
      {{ lead }}
    </p>
    <slot />
  </header>
</template>
