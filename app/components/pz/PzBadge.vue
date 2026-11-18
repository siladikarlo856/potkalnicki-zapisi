<script setup lang="ts">
import type { PzNoun } from '~/utils/pzText'
// How many: active filters, items waiting. Hidden at zero. Not for kinds or states.
// The number alone is not enough, so `noun` adds hidden text that agrees with the count ("2 aktivna filtra"). Without `count` it carries a
// few words as a status ("Na tebi je red").
const props = withDefaults(defineProps<{
  count?: number
  /** Hidden text after the number, inflected: ['aktivni filtar', 'aktivna filtra', 'aktivnih filtara']. */
  noun?: PzNoun
  variant?: 'default' | 'attn' | 'quiet'
}>(), { variant: 'default' })

const VARIANTS = {
  default: 'bg-primary text-inverted',
  attn: 'bg-(--pz-accent) text-(--pz-on-accent)',
  quiet: 'bg-elevated text-default'
} as const

const hidden = computed(() => props.count === 0)
const nounText = computed(() => props.count !== undefined && props.noun ? nounFor(props.count, props.noun) : '')
</script>

<template>
  <span
    v-if="!hidden"
    class="inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-full px-2 text-xs font-bold whitespace-nowrap tabular-nums forced-colors:border forced-colors:border-[CanvasText]"
    :class="VARIANTS[variant]"
    data-testid="pz-badge"
    :data-variant="variant"
  >
    <template v-if="count !== undefined">{{ count }}<span
      v-if="nounText"
      class="sr-only"
    >{{ ' ' + nounText }}</span></template>
    <slot v-else />
  </span>
</template>
