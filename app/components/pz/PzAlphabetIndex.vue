<script setup lang="ts">
// "Riječi po početnom slovu": all thirty letters, digraphs included (DŽ, LJ, NJ). Letters with entries are links;
// letters without are plain muted text, not links. The current letter is an ink fill with aria-current="true".
// Pass `available` as upper-case letters; `to` builds each link.
const props = withDefaults(defineProps<{
  available: string[]
  current?: string
  to?: (letter: string) => string
  label?: string
}>(), {
  label: 'Riječi po početnom slovu',
  to: (letter: string) => `?slovo=${encodeURIComponent(letter.toLocaleLowerCase('hr'))}`
})

const have = computed(() => new Set(props.available.map(letter => letter.toLocaleUpperCase('hr'))))
</script>

<template>
  <nav
    :aria-label="label"
    class="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1"
    data-testid="alphabet-index"
  >
    <template
      v-for="letter in HR_ALPHABET"
      :key="letter"
    >
      <NuxtLink
        v-if="have.has(letter)"
        :to="to(letter)"
        class="grid min-h-11 place-items-center rounded-sm border font-bold no-underline hover:border-accented"
        :class="current?.toLocaleUpperCase('hr') === letter
          ? 'border-default bg-inverted text-inverted forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]'
          : 'border-default bg-default text-default'"
        :aria-current="current?.toLocaleUpperCase('hr') === letter ? 'true' : undefined"
      >{{ letter }}</NuxtLink>
      <span
        v-else
        class="grid min-h-11 place-items-center rounded-sm text-muted"
        data-testid="alphabet-empty"
      >{{ letter }}</span>
    </template>
  </nav>
</template>
