<script setup lang="ts">
const props = withDefaults(defineProps<{ open: boolean, title: string, description?: string, confirmation?: boolean }>(), { confirmation: false })
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
useHidePzTabBar(() => props.open, 'sheet')
const isTablet = ref(false)
onMounted(() => {
  const query = window.matchMedia('(min-width: 768px)')
  const update = () => {
    isTablet.value = query.matches
  }
  update()
  query.addEventListener('change', update)
  onBeforeUnmount(() => query.removeEventListener('change', update))
})
</script>

<template>
  <UModal
    v-if="isTablet"
    :open="props.open"
    :dismissible="!confirmation"
    :title="title"
    :description="description"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <slot />
    </template><template #footer>
      <slot name="footer" />
    </template>
  </UModal>
  <UDrawer
    v-else
    :open="props.open"
    direction="bottom"
    :dismissible="!confirmation"
    :title="title"
    :description="description"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <slot />
    </template><template #footer>
      <slot name="footer" />
    </template>
  </UDrawer>
</template>
