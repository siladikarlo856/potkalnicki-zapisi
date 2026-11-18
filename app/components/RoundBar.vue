<script setup lang="ts">
defineProps<{ title: string, current: number, total: number, score?: number }>()
</script>

<template>
  <header
    class="sticky top-0 z-50 border-b border-default bg-(--pz-bg)"
    data-testid="round-bar"
  >
    <UContainer class="flex min-h-14 items-center gap-3">
      <IconButton
        label="Izađi iz igre"
        icon="i-lucide-x"
        variant="ghost"
      /><p class="min-w-0 flex-1 truncate font-semibold">
        {{ title }}
      </p><div class="hidden min-w-32 flex-1 sm:block">
        <UProgress
          :model-value="current / total * 100"
          aria-label="Napredak"
        />
      </div><span class="pz-caption tabular-nums">{{ current }}/{{ total }}</span><span
        v-if="score !== undefined"
        class="pz-caption tabular-nums"
      >Bodovi: {{ score }}</span>
    </UContainer>
  </header>
</template>
