<script setup lang="ts">
// "Imaš nespremljene izmjene": leaving an editor with changes. Three ways out; focus starts on "Ostani". Opened through
// `useAdminUnsavedChoice()`. A published record has no draft to save, so "Spremi skicu i izađi" is only offered for drafts.
defineProps<{
  fields: number
  canSaveDraft: boolean
}>()
const emit = defineEmits<{ close: [choice: 'discard' | 'stay' | 'save'] }>()
</script>

<template>
  <UModal
    title="Imaš nespremljene izmjene"
    :description="`Izmjene u ${fields} ${nounFor(fields, ['polju', 'polja', 'polja'])} izgubit će se ako sada odeš.`"
    :close="false"
    :dismissible="false"
    :ui="{ footer: 'flex-wrap justify-end' }"
    data-test="admin-confirm"
  >
    <template #footer>
      <UButton
        label="Odbaci izmjene"
        color="error"
        variant="outline"
        data-test="admin-unsaved-discard"
        @click="emit('close', 'discard')"
      />
      <UButton
        label="Ostani"
        color="neutral"
        variant="outline"
        autofocus
        data-test="admin-unsaved-stay"
        @click="emit('close', 'stay')"
      />
      <UButton
        v-if="canSaveDraft"
        label="Spremi skicu i izađi"
        data-test="admin-unsaved-save"
        @click="emit('close', 'save')"
      />
    </template>
  </UModal>
</template>
