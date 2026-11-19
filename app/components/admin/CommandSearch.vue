<script setup lang="ts">
import { ADMIN_NAV_GROUPS } from '~/utils/adminNav'

// Ctrl K / Cmd K: jump to a resource. The palette lists the navigation; it does not search records.
const open = defineModel<boolean>('open', { default: false })
const route = useRoute()

const groups = computed(() => ADMIN_NAV_GROUPS.map(group => ({
  id: group.label,
  label: group.label,
  items: group.items.map(item => ({ label: item.label, icon: item.icon, to: item.to }))
})))

watch(() => route.fullPath, () => {
  open.value = false
})

defineShortcuts({
  meta_k: { usingInput: true, handler: () => { open.value = !open.value } },
  ctrl_k: { usingInput: true, handler: () => { open.value = !open.value } }
})
</script>

<template>
  <UModal
    v-model:open="open"
    title="Traži ili skoči na…"
    description="Odaberi resurs na koji želiš skočiti."
    :ui="{ content: 'max-w-[560px]' }"
  >
    <template #content>
      <UCommandPalette
        :groups="groups"
        placeholder="Traži ili skoči na…"
        close
        class="h-96"
        data-testid="admin-command-palette"
        @update:open="open = $event"
      />
    </template>
  </UModal>
</template>
