<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
defineProps<{ items: Array<{ label: string, to: string }> }>()
</script>

<template>
  <nav
    aria-label="Putanja"
    class="mb-4"
  >
    <ol class="flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted">
      <li
        v-for="(item, index) in items"
        :key="item.to"
        class="flex min-w-0 items-center gap-1"
      >
        <UIcon
          v-if="index"
          name="i-lucide-chevron-right"
          class="size-4 shrink-0"
          aria-hidden="true"
        />
        <NuxtLink
          :to="item.to"
          class="min-h-8 rounded-md px-1 py-1 underline-offset-2 hover:underline first:max-md:hidden last:max-md:inline-block"
        >{{ item.label }}</NuxtLink>
      </li>
    </ol>
  </nav>
</template>
