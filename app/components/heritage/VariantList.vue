<script setup lang="ts">
import type { WordEntry } from '~/types/heritage'

const props = defineProps<{
  entry: WordEntry
}>()

const sample = computed(() => props.entry.status === 'placeholder')
</script>

<template>
  <ul class="flex flex-col gap-1.5">
    <li
      v-for="(variant, index) in entry.variants"
      :key="variant.id"
      class="flex flex-wrap items-center gap-1.5"
    >
      <span
        class="rounded-md px-2 py-0.5 text-sm font-semibold"
        :class="index === 0 ? 'bg-primary/10 text-primary ring ring-primary/25 ring-inset' : 'bg-elevated text-highlighted'"
      >
        <template v-if="index === 0">{{ variant.form }}</template>
        <template v-else>
          <span class="sr-only">{{ variant.form }}</span>
          <span
            v-for="(part, partIndex) in letterDiff(entry.headword, variant.form)"
            :key="partIndex"
            aria-hidden="true"
            :class="{
              'rounded-xs bg-primary/25 underline decoration-primary decoration-2 underline-offset-2': part.kind === 'added',
              'font-normal text-dimmed line-through': part.kind === 'removed'
            }"
          >{{ part.text }}</span>
        </template>
      </span>
      <span
        v-if="index === 0"
        class="text-[10px] tracking-wide text-dimmed uppercase"
      >osnovni oblik</span>
      <HeritageAreaTag
        v-for="usage in variant.usages"
        :key="usage.areaId"
        :usage="usage"
        :sample="sample"
      />
    </li>
  </ul>
</template>
