<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
withDefaults(defineProps<{ title: string, description?: string, color?: 'neutral' | 'success' | 'warning' | 'error', role?: 'alert' | 'status' | 'note' }>(), { color: 'neutral', role: 'note' })
</script>

<template>
  <UAlert
    :color="color === 'neutral' ? 'neutral' : color"
    variant="subtle"
    :title="title"
    :description="description"
    :role="role"
  />
</template>
