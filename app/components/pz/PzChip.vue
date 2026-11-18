<script setup lang="ts">
// Chip: toggle a filter (button with aria-pressed), link to a place or theme (`to`), or show an active filter that
// can be removed (`removable`). Always interactive; a non-interactive label is a PzKindTag.
// Selected is an ink fill plus a check icon, so it never depends on colour alone.
const props = defineProps<{
  /** Toggle state; setting it makes the chip a toggle button. */
  selected?: boolean
  /** Makes the chip a link. */
  to?: string
  /** Active filter: ends with an x and hidden text ", ukloni filtar". */
  removable?: boolean
  count?: number
  /** Hidden text after the count where it would be unclear ("zapisa"). */
  countNoun?: string
  /** Admin, fine pointer: 30px high. */
  dense?: boolean
}>()

const kind = computed(() => props.to ? 'link' : props.removable ? 'removable' : 'toggle')
const isToggle = computed(() => kind.value === 'toggle' && props.selected !== undefined)
const isSelected = computed(() => props.selected === true)

const base = 'relative inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[0.9375rem] font-semibold whitespace-nowrap no-underline cursor-pointer'
const classes = computed(() => [
  base,
  props.dense ? 'min-h-7.5' : 'min-h-11',
  isSelected.value
    ? 'border-default bg-inverted text-inverted forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]'
    : 'border-accented bg-default text-default hover:bg-elevated hover:border-inverted'
])
</script>

<template>
  <NuxtLink
    v-if="kind === 'link'"
    :to="to"
    :class="classes"
    data-testid="pz-chip"
    data-kind="link"
  >
    <slot />
    <small
      v-if="count !== undefined"
      class="text-sm font-medium tabular-nums opacity-80"
    >{{ count }}<span
      v-if="countNoun"
      class="sr-only"
    >{{ ' ' + countNoun }}</span></small>
  </NuxtLink>
  <button
    v-else
    type="button"
    :class="classes"
    :aria-pressed="isToggle ? isSelected : undefined"
    data-testid="pz-chip"
    :data-kind="kind"
  >
    <UIcon
      v-if="isSelected"
      name="i-lucide-check"
      class="size-4 shrink-0"
      aria-hidden="true"
    />
    <slot />
    <small
      v-if="count !== undefined"
      class="text-sm font-medium tabular-nums opacity-80"
    >{{ count }}<span
      v-if="countNoun"
      class="sr-only"
    >{{ ' ' + countNoun }}</span></small>
    <template v-if="removable">
      <UIcon
        name="i-lucide-x"
        class="size-4 shrink-0"
        aria-hidden="true"
      />
      <span class="sr-only">, ukloni filtar</span>
    </template>
  </button>
</template>
