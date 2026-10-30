<script setup lang="ts">
defineProps<{ english?: boolean }>()
</script>

<template>
  <span
    class="rounded-md border border-dashed border-accented px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase"
    :title="english ? 'Sample — these words are not yet verified' : 'Uzorak — riječi još nisu provjerene'"
    lang="hr"
  >
    Uzorak<span class="sr-only normal-case"> — riječi još nisu provjerene</span><span
      v-if="english"
      class="sr-only normal-case"
      lang="en"
    > (sample, not verified)</span>
  </span>
</template>
