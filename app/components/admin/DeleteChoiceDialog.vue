<script setup lang="ts">
// A destructive confirmation as the design asks for it: it names the object and the consequence, offers the reversible
// alternative, and the destructive button names the action. Focus starts on "Odustani". Opened through `useAdminDeleteChoice()`.
defineProps<{
  title: string
  description: string
  deleteLabel: string
  /** Without an alternative (already archived) only Odustani and the delete remain. */
  archiveLabel?: string
}>()
const emit = defineEmits<{ close: [choice: 'cancel' | 'archive' | 'delete'] }>()
</script>

<template>
  <UModal
    :title="title"
    :description="description"
    :close="false"
    :dismissible="false"
    :ui="{ footer: 'flex-wrap justify-end' }"
    data-test="admin-confirm"
  >
    <template #footer>
      <UButton
        label="Odustani"
        color="neutral"
        variant="outline"
        autofocus
        data-test="admin-confirm-cancel"
        @click="emit('close', 'cancel')"
      />
      <UButton
        v-if="archiveLabel"
        :label="archiveLabel"
        color="neutral"
        variant="outline"
        data-test="admin-confirm-archive"
        @click="emit('close', 'archive')"
      />
      <UButton
        :label="deleteLabel"
        color="error"
        data-test="admin-confirm-accept"
        @click="emit('close', 'delete')"
      />
    </template>
  </UModal>
</template>
