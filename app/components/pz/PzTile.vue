<script setup lang="ts">
// Entry points on hubs: the five archive sections, suggested games. One link; the icon is decorative; the line
// (a count or one short sentence) may be missing, then only the name shows. No button inside a tile.
// `surface` sits directly on the page ground; `row` is icon left, name and a sentence right; `link` is a row that
// opens another page (a town or municipality's Baština): bordered on the ground, the name in link colour and an arrow
// at the end, so it reads as a link at rest and not only on hover.
defineProps<{
  to: string
  icon: string
  name: string
  line?: string
  variant?: 'default' | 'surface' | 'row' | 'link'
}>()
</script>

<template>
  <NuxtLink
    :to="to"
    class="group flex gap-1.5 rounded-md border-[1.5px] p-3 text-[0.96875rem]/[1.25] font-bold text-default no-underline"
    :class="[
      variant === 'link'
        ? 'items-center gap-3 border-accented bg-default hover:bg-muted'
        : variant === 'surface' ? 'border-default bg-default hover:border-accented' : 'border-transparent bg-elevated hover:border-accented',
      variant !== 'link' && 'min-h-23',
      variant === 'row' && 'min-h-16 items-center gap-3',
      (variant === 'row' || variant === 'link') ? '' : 'flex-col'
    ]"
    data-testid="pz-tile"
    :data-variant="variant ?? 'default'"
  >
    <span
      v-if="variant === 'link'"
      class="grid size-10 shrink-0 place-items-center rounded-(--pz-radius-md) bg-accented text-primary"
    >
      <UIcon
        :name="icon"
        class="size-5"
        aria-hidden="true"
      />
    </span>
    <UIcon
      v-else
      :name="icon"
      class="size-6 shrink-0 text-primary"
      aria-hidden="true"
    />
    <span
      class="flex min-w-0 flex-col"
      :class="[(variant === 'row' || variant === 'link') && 'gap-0.5', variant === 'link' && 'flex-1']"
    >
      <span :class="variant === 'link' && 'text-primary underline-offset-4 group-hover:underline'">{{ name }}</span>
      <small
        v-if="line"
        class="text-xs font-medium text-muted"
      >{{ line }}</small>
    </span>
    <UIcon
      v-if="variant === 'link'"
      name="i-lucide-arrow-right"
      class="size-5 shrink-0 text-primary"
      aria-hidden="true"
      data-testid="pz-tile-arrow"
    />
  </NuxtLink>
</template>
