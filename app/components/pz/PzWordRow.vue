<script setup lang="ts">
// A dictionary row: headword, meaning on the line below, and at the end a part-of-speech tag, a chevron or a
// sample label. One link whose name is the word then the meaning. Never truncates a headword. `query` marks the
// matched letters in a <mark>, folding case and diacritics (skrlak finds škrlak).
import { foldHr } from '~/utils/pzText'

const props = defineProps<{
  to: string
  word: string
  meaning: string
  /** Part of speech: imenica, glagol. */
  pos?: string
  sample?: boolean
  query?: string
}>()

const parts = computed(() => {
  const q = foldHr(props.query ?? '').trim()
  if (!q) return [{ text: props.word, match: false }]
  // Fold character by character so the folded string keeps the same length as the original.
  const folded = Array.from(props.word, ch => foldHr(ch)).map(s => s.length === 1 ? s : s[0]!).join('')
  const at = folded.indexOf(q)
  if (at < 0 || folded.length !== props.word.length) return [{ text: props.word, match: false }]
  return [
    { text: props.word.slice(0, at), match: false },
    { text: props.word.slice(at, at + q.length), match: true },
    { text: props.word.slice(at + q.length), match: false }
  ].filter(part => part.text)
})
</script>

<template>
  <NuxtLink
    :to="to"
    class="group grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2.5 text-default no-underline"
    data-testid="word-row"
  >
    <span class="font-display text-xl/[1.2] font-bold group-hover:underline group-hover:underline-offset-[3px]"><template
      v-for="(part, i) in parts"
      :key="i"
    ><mark
      v-if="part.match"
      class="rounded-xs bg-(--pz-accent-well) text-(--pz-on-accent)"
    >{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></span>
    <span class="col-start-1 text-muted">{{ meaning }}</span>
    <span class="col-start-2 row-span-2 row-start-1 inline-flex items-center gap-2 text-muted">
      <PzSampleLabel v-if="sample" />
      <PzKindTag v-if="pos">{{ pos }}</PzKindTag>
      <UIcon
        v-else-if="!sample"
        name="i-lucide-chevron-right"
        class="size-5"
        aria-hidden="true"
      />
    </span>
  </NuxtLink>
</template>
