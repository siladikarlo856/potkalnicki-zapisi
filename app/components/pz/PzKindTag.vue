<script setup lang="ts">
// The kind of a record in mixed lists (Priča, Običaj, Sakralna građevina, imenica). Neutral, no icon, no border:
// it is not a trust label and must not look like one. `overline` is the form above a title: "Priča · predaja".
defineProps<{ overline?: boolean }>()
</script>

<template>
  <p
    v-if="overline"
    class="pz-overline text-muted"
    data-testid="kind-overline"
  >
    <slot />
  </p>
  <UBadge
    v-else
    color="neutral"
    variant="soft"
    size="sm"
    class="rounded-[6px] text-[0.8125rem]/[1.4] font-bold"
    data-testid="kind-tag"
  >
    <slot />
  </UBadge>
</template>
