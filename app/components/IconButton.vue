<script setup lang="ts">
withDefaults(defineProps<{ label: string, icon: string, variant?: 'solid' | 'ghost' | 'outline' }>(), { variant: 'outline' })
</script>

<template>
  <UButton
    square
    :icon="icon"
    :aria-label="label"
    color="neutral"
    :variant="variant"
    class="size-(--pz-tap-min) justify-center"
  />
</template>
