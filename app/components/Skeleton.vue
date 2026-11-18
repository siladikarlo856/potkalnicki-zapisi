<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
withDefaults(defineProps<{ lines?: number, block?: boolean, label?: string }>(), { lines: 3, block: false, label: 'Učitavanje zapisa…' })
</script>

<template>
  <div aria-busy="true">
    <span
      class="sr-only"
      role="status"
    >{{ label }}</span><div
      v-if="block"
      class="h-40 animate-pulse rounded-lg bg-elevated"
      aria-hidden="true"
    /><div
      v-else
      class="space-y-3"
      aria-hidden="true"
    >
      <USkeleton
        v-for="line in lines"
        :key="line"
        class="h-5"
        :class="line === 1 ? 'w-2/3' : 'w-full'"
      />
    </div>
  </div>
</template>
