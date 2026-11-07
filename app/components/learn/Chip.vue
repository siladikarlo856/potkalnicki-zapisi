<script setup lang="ts">
// A toggle chip for topics and lesson lengths. Selected: pale sage with a 2px primary edge. Disabled ("uskoro"):
// muted text on the muted ground with the quiet edge, never just lowered opacity. `aria-pressed` carries the state.
defineProps<{
  label: string
  selected?: boolean
  disabled?: boolean
}>()
</script>

<template>
  <button
    type="button"
    class="pz-label inline-flex min-h-(--pz-tap-min) items-center justify-center gap-1.5 rounded-(--pz-radius-md) border text-center transition-colors duration-150 motion-reduce:transition-none"
    :class="disabled
      ? 'cursor-not-allowed border-default bg-muted px-3 text-dimmed'
      : selected
        ? 'cursor-pointer border-2 border-primary bg-accented px-[11px] text-default'
        : 'cursor-pointer border-accented bg-default px-3 text-default hover:bg-muted'"
    :aria-pressed="selected ? 'true' : 'false'"
    :aria-disabled="disabled ? 'true' : undefined"
    :disabled="disabled"
    data-testid="learn-chip"
  >
    <UIcon
      v-if="selected"
      name="i-lucide-check"
      class="size-4 shrink-0"
      aria-hidden="true"
    />
    {{ label }}
  </button>
</template>
