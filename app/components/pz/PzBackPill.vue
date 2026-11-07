<script setup lang="ts">
// "← Općina Kalnik": the way up from a detail page, at the top of settlement, heritage and word pages.
// A quiet pill rather than a breadcrumb trail; the label names where it goes.
defineProps<{
  to: string
}>()
</script>

<template>
  <NuxtLink
    :to="to"
    class="pz-label inline-flex min-h-(--pz-tap-min) items-center gap-1.5 self-start rounded-full border border-accented bg-default px-3.5 text-default no-underline hover:bg-muted"
    data-testid="pz-back-pill"
  >
    <UIcon
      name="i-lucide-arrow-left"
      class="size-4 shrink-0"
      aria-hidden="true"
    />
    <span><slot /></span>
  </NuxtLink>
</template>
