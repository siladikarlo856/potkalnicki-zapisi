<script setup lang="ts">
// A confirmation in a modal, opened through `useAdminConfirm()` (useOverlay). It replaces
// window.confirm everywhere in the admin. Emits `close` with true only when confirmed.
withDefaults(defineProps<{
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  color?: 'primary' | 'error' | 'warning' | 'neutral'
  icon?: string
}>(), {
  description: undefined,
  confirmLabel: 'Potvrdi',
  cancelLabel: 'Odustani',
  color: 'primary',
  icon: undefined
})
const emit = defineEmits<{ close: [confirmed: boolean] }>()
</script>

<template>
  <UModal
    :title="title"
    :description="description"
    :close="false"
    :ui="{ footer: 'justify-end' }"
    data-test="admin-confirm"
  >
    <template
      v-if="icon"
      #body
    >
      <UIcon
        :name="icon"
        class="size-8 text-muted"
      />
    </template>
    <template #footer>
      <UButton
        :label="cancelLabel"
        color="neutral"
        variant="ghost"
        data-test="admin-confirm-cancel"
        @click="emit('close', false)"
      />
      <UButton
        :label="confirmLabel"
        :color="color"
        data-test="admin-confirm-accept"
        @click="emit('close', true)"
      />
    </template>
  </UModal>
</template>
