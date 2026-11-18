<script setup lang="ts">
// Admin only: is the record public? Square (never a pill), no outline, never green or blue, so it cannot be
// mistaken for verification or protection. Without `status` it is a plain neutral label such as "Naslovna".
const props = defineProps<{
  status?: 'draft' | 'published' | 'archived'
  /** "ima neobjavljene izmjene", with a small ochre dot. */
  unpublishedChanges?: boolean
}>()

const STATUSES = {
  draft: { label: 'Skica', icon: 'i-lucide-pencil-line', variant: 'soft', classes: '' },
  published: { label: 'Objavljeno', icon: 'i-lucide-globe', variant: 'solid', classes: '' },
  archived: { label: 'Arhivirano', icon: 'i-lucide-archive', variant: 'soft', classes: 'italic' }
} as const

const current = computed(() => props.status ? STATUSES[props.status] : undefined)
</script>

<template>
  <span
    class="inline-flex flex-wrap items-center gap-x-2 gap-y-1"
    data-testid="status-badge"
    :data-status="status ?? 'plain'"
  >
    <UBadge
      color="neutral"
      :variant="current?.variant ?? 'soft'"
      :icon="current?.icon"
      :class="['rounded-xs text-[0.8125rem]/[1.4] font-bold', current?.classes]"
    >
      <template v-if="current">
        {{ current.label }}
      </template>
      <slot v-else />
    </UBadge>
    <span
      v-if="unpublishedChanges"
      class="inline-flex items-center gap-1.5 text-xs text-muted"
    >
      <span
        class="size-1.5 rounded-full bg-(--pz-accent)"
        aria-hidden="true"
      />ima neobjavljene izmjene
    </span>
  </span>
</template>
