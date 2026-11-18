<script setup lang="ts">
// A dialect word inside running text: bold italic, with its meaning in real parentheses, upright and muted.
// Always give the meaning (never only in a tooltip) and keep the source's spelling. With `to` the word links to
// its page; a dotted underline plus weight marks the link, not colour. The meaning may be left out on later uses.
defineProps<{
  word: string
  meaning?: string
  to?: string
}>()
</script>

<template>
  <span data-testid="dialect-term"><NuxtLink
    v-if="to"
    :to="to"
    class="underline decoration-dotted underline-offset-[3px]"
  ><i class="font-bold">{{ word }}</i></NuxtLink><i
    v-else
    class="font-bold"
  >{{ word }}</i><span
    v-if="meaning"
    class="text-muted"
  > ({{ meaning }})</span></span>
</template>
