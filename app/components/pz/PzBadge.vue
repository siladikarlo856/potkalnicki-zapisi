<script setup lang="ts">
// How many: active filters, items waiting. Hidden at zero. Not for kinds or states.
// The number alone is not enough, so `noun` adds hidden text ("2 aktivna filtra"). Without `count` it carries a
// few words as a status ("Na tebi je red").
const props = withDefaults(defineProps<{
  count?: number
  /** Hidden text after the number: "aktivna filtra", "priloga čeka pregled". */
  noun?: string
  variant?: 'default' | 'attn' | 'quiet'
}>(), { variant: 'default' })

const VARIANTS = {
  default: 'bg-primary text-inverted',
  attn: 'bg-(--pz-accent) text-(--pz-on-accent)',
  quiet: 'bg-elevated text-default'
} as const

const hidden = computed(() => props.count === 0)
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
      v-if="noun"
      class="sr-only"
    >{{ ' ' + noun }}</span></template>
    <slot v-else />
  </span>
</template>
