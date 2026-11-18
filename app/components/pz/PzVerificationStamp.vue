<script setup lang="ts">
// Provjera: has an editor checked the record against its sources? Three states, one size, never a solid fill.
// A <span> in lists (the whole card is one link); a <button aria-haspopup="dialog"> on a record page,
// where the consumer opens the "Što znači …?" sheet from the `click` event.
// Never the legal status (PzProtectionPlaque) and never a content kind (PzKindTag).
const props = defineProps<{
  state: 'pend' | 'ok' | 'warn'
  interactive?: boolean
}>()

const STATES = {
  pend: { label: 'U provjeri', icon: 'i-lucide-circle-dashed', classes: 'border-dashed bg-(--pz-pend-bg) text-(--pz-pend)' },
  ok: { label: 'Provjereno', icon: 'i-lucide-check', classes: 'bg-(--pz-ok-bg) text-success' },
  warn: { label: 'Treba ažurirati', icon: 'i-lucide-refresh-cw', classes: 'bg-(--pz-warn-bg) text-warning' }
} as const

const current = computed(() => STATES[props.state])
</script>

<template>
  <component
    :is="interactive ? 'button' : 'span'"
    :type="interactive ? 'button' : undefined"
    :aria-haspopup="interactive ? 'dialog' : undefined"
    class="relative inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-current py-[3px] pr-[11px] pl-[7px] text-[0.8125rem]/[1.4] font-bold whitespace-nowrap"
    :class="[current.classes, interactive && 'cursor-pointer after:absolute after:-inset-x-1 after:-inset-y-2.25 after:content-[\'\'] hover:shadow-[0_0_0_2px_currentColor]']"
    :data-testid="`verification-stamp-${state}`"
    :data-state="state"
  >
    <UIcon
      :name="current.icon"
      class="size-4 shrink-0"
      aria-hidden="true"
    />{{ current.label }}
  </component>
</template>
