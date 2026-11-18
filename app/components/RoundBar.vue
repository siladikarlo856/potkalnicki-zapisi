<script setup lang="ts">
const props = defineProps<{ title: string, current: number, total: number, score?: number, exitTo?: string }>()
useHidePzTabBar(() => true, 'round')
const open = ref(false)
const localePath = useLocalePath()

function leave() {
  open.value = false
  navigateTo(localePath(props.exitTo ?? '/igre/'))
}
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
        @click="open = true"
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
  <AppSheet
    v-model:open="open"
    title="Želiš li prekinuti igru?"
    description="Napredak u ovoj igri neće se spremiti."
    confirmation
  >
    <p class="text-toned">
      Napredak u ovoj igri neće se spremiti.
    </p>
    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton
          label="Nastavi igru"
          color="primary"
          @click="open = false"
        />
        <UButton
          label="Prekini"
          color="neutral"
          variant="outline"
          @click="leave"
        />
      </div>
    </template>
  </AppSheet>
</template>
