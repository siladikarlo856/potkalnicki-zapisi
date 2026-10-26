<script setup lang="ts">
import type { WordEntry } from '~/types/heritage'

const props = defineProps<{
  entry: WordEntry
  /** Smaller card without the variant list, used as the homepage preview. */
  compact?: boolean
  /** Optional translation of the meaning, shown under it. */
  gloss?: string
}>()

const flipped = defineModel<boolean>('flipped', { default: false })

const sample = computed(() => props.entry.status === 'placeholder')
const headVariant = computed(() => props.entry.variants[0])
const otherForms = computed(() => props.entry.variants.slice(1).map(variant => variant.form).join(' · '))
const example = computed(() => props.entry.examples?.[0])
</script>

<template>
  <div
    class="cursor-pointer perspective-distant"
    :class="compact ? 'h-64' : 'h-96'"
    lang="hr"
    @click="flipped = !flipped"
  >
    <div
      class="relative size-full transition-transform duration-500 transform-3d motion-reduce:transition-none"
      :class="{ 'rotate-y-180': flipped }"
    >
      <div
        class="absolute inset-0 flex flex-col rounded-xl bg-default p-5 shadow-sm ring ring-default backface-hidden"
        :aria-hidden="flipped"
        :inert="flipped"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-semibold tracking-wide text-primary uppercase">Kaj to znači?</span>
          <HeritageSampleBadge v-if="sample" />
        </div>
        <div class="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p
            class="font-bold tracking-tight text-highlighted"
            :class="compact ? 'text-4xl' : 'text-5xl'"
          >
            {{ entry.headword }}
          </p>
          <p
            v-if="entry.partOfSpeech"
            class="text-sm text-muted"
          >
            {{ entry.partOfSpeech }}
          </p>
          <div
            v-if="!compact && headVariant"
            class="mt-1 flex flex-wrap justify-center gap-1"
          >
            <HeritageAreaTag
              v-for="usage in headVariant.usages"
              :key="usage.areaId"
              :usage="usage"
              :sample="sample"
            />
          </div>
        </div>
        <p class="flex items-center justify-center gap-1 text-xs text-dimmed">
          <UIcon
            name="i-lucide-pointer"
            class="size-3.5 shrink-0"
          />
          Dodirni karticu za otkrivanje
        </p>
      </div>

      <div
        class="absolute inset-0 flex rotate-y-180 flex-col gap-3 overflow-y-auto rounded-xl bg-default p-5 shadow-sm ring-2 ring-primary/40 backface-hidden"
        :aria-hidden="!flipped"
        :inert="!flipped"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm text-muted">
            <span class="font-semibold text-default">{{ entry.headword }}</span>
            <template v-if="entry.partOfSpeech">
              · {{ entry.partOfSpeech }}
            </template>
          </p>
          <HeritageSampleBadge v-if="sample" />
        </div>
        <div>
          <p class="text-xs text-muted">
            Značenje
          </p>
          <p class="text-3xl font-bold text-highlighted">
            {{ entry.meaning.hr }}
          </p>
          <p
            v-if="gloss"
            class="text-sm text-muted"
            lang="en"
          >
            ({{ gloss }})
          </p>
        </div>
        <p
          v-if="example"
          class="text-sm"
        >
          <span class="text-muted">Primjer:</span>
          <i class="text-default">{{ example.text }}</i>
          <span
            v-if="example.translation"
            class="text-muted"
          > — {{ example.translation }}</span>
        </p>
        <p
          v-if="compact && otherForms"
          class="text-sm text-muted"
        >
          Čuje se i: <span class="font-semibold text-default">{{ otherForms }}</span>
        </p>
        <div
          v-if="!compact"
          class="border-t border-default pt-3"
        >
          <p class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
            <UIcon
              name="i-lucide-git-fork"
              class="size-3.5 shrink-0"
            />
            Inačice po mjestima
          </p>
          <HeritageVariantList :entry="entry" />
        </div>
      </div>
    </div>
  </div>
</template>
