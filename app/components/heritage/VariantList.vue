<script setup lang="ts">
import type { WordEntry } from '~/types/heritage'

const props = defineProps<{
  entry: WordEntry
  /** Gives the base-form label in English and is passed on to the area tags, for /en visitors. */
  english?: boolean
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
        :class="index === 0 ? 'bg-primary/10 text-(--ui-color-primary-800) ring ring-primary/25 ring-inset dark:text-primary' : 'bg-elevated text-highlighted'"
      >
        <template v-if="index === 0">{{ variant.form }}</template>
        <template v-else>
          <!-- Removed letters use the toned shade: dimmed text is only 4.35:1 on this chip's elevated background. -->
          <span class="sr-only">{{ variant.form }}</span>
          <span
            v-for="(part, partIndex) in letterDiff(entry.headword, variant.form)"
            :key="partIndex"
            aria-hidden="true"
            :class="{
              'rounded-xs bg-primary/25 underline decoration-primary decoration-2 underline-offset-2': part.kind === 'added',
              'font-normal text-toned line-through': part.kind === 'removed'
            }"
          >{{ part.text }}</span>
        </template>
      </span>
      <span
        v-if="index === 0"
        class="text-[10px] tracking-wide text-muted uppercase"
        :lang="english ? 'en' : undefined"
      >{{ english ? 'base form' : 'osnovni oblik' }}</span>
      <HeritageAreaTag
        v-if="!variant.usages.length"
        :sample="sample"
        :english="english"
      />
      <HeritageAreaTag
        v-for="usage in variant.usages"
        :key="usage.areaId"
        :usage="usage"
        :sample="sample"
        :english="english"
      />
    </li>
  </ul>
</template>
