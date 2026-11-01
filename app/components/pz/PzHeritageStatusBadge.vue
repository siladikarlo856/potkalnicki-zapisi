<script setup lang="ts">
defineProps<{
  label?: string
}>()
</script>

<template>
  <UBadge
    color="warning"
    variant="subtle"
    class="gap-1"
    data-testid="heritage-status-unverified"
  >
    <UIcon
      name="i-lucide-shield-alert"
      class="size-3.5 shrink-0"
    />
    <span>{{ label ?? 'U provjeri' }}</span>
  </UBadge>
</template>
