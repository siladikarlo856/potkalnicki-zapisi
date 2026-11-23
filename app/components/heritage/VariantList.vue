<script setup lang="ts">
import type { WordEntry } from '~/types/heritage'
import { orderVariantsForPlace } from '~~/shared/utils/wordVariantOrder'

const props = defineProps<{
  entry: WordEntry
  /** Published Naselje id from the effective /uci place; omitted when no place is chosen. */
  placeAreaId?: string
  /** True only when the effective place is the signed-in account's saved main place. */
  placeIsMain?: boolean
  /** Gives the base-form label in English and is passed on to the area tags, for /en visitors. */
  english?: boolean
}>()

const { t } = useI18n()
const sample = computed(() => props.entry.status === 'placeholder')

const ordering = computed(() => orderVariantsForPlace(props.entry.variants, props.placeAreaId))
const variants = computed(() => ordering.value.ordered)
const isBaseForm = (variantId: string) => props.entry.variants[0]?.id === variantId
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <p
      v-if="ordering.state === 'no-match'"
      class="pz-caption text-muted"
      data-testid="variant-no-match"
    >
      {{ t('pz.learn.noVariantForChosenPlace') }}
    </p>
    <ul class="flex flex-col gap-1.5">
      <li
        v-for="(variant, index) in variants"
        :key="variant.id"
        class="flex flex-wrap items-center gap-1.5"
        :data-testid="ordering.preferredId === variant.id ? 'variant-preferred' : undefined"
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
          v-if="ordering.preferredId === variant.id"
          class="text-[10px] tracking-wide text-primary uppercase"
          :lang="english ? 'en' : undefined"
        >{{ t(placeIsMain ? 'pz.learn.mainPlaceVariant' : 'pz.learn.selectedPlaceVariant') }}</span>
        <span
          v-if="isBaseForm(variant.id)"
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
  </div>
</template>
