<script setup lang="ts">
// Entry points on hubs: the five archive sections, suggested games. One link; the icon is decorative; the line
// (a count or one short sentence) may be missing, then only the name shows. No button inside a tile.
// `surface` sits directly on the page ground; `row` is icon left, name and a sentence right.
defineProps<{
  to: string
  icon: string
  name: string
  line?: string
  variant?: 'default' | 'surface' | 'row'
}>()
</script>

<template>
  <NuxtLink
    :to="to"
    class="flex min-h-23 gap-1.5 rounded-md border-[1.5px] p-3 text-[0.96875rem]/[1.25] font-bold text-default no-underline hover:border-accented"
    :class="[
      variant === 'surface' ? 'border-default bg-default' : 'border-transparent bg-elevated',
      variant === 'row' ? 'min-h-16 items-center gap-3' : 'flex-col'
    ]"
    data-testid="pz-tile"
    :data-variant="variant ?? 'default'"
  >
    <UIcon
      :name="icon"
      class="size-6 shrink-0 text-primary"
      aria-hidden="true"
    />
    <span
      class="flex min-w-0 flex-col"
      :class="variant === 'row' && 'gap-0.5'"
    >
      <span>{{ name }}</span>
      <small
        v-if="line"
        class="text-xs font-medium text-muted"
      >{{ line }}</small>
    </span>
  </NuxtLink>
</template>
