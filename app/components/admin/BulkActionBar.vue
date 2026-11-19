<script setup lang="ts">
// The bar that replaces the filter bar while rows are ticked: the count (inflected), the actions, a way to clear the
// selection; while an action runs it shows progress with a way to stop. The result is shown by the page in an Alert.
export interface BulkAction {
  key: string
  label: string
  icon?: string
  /** A menu of values instead of one button: choosing one emits `action` as `key:value`. */
  items?: Array<{ label: string, value: string }>
}
const props = defineProps<{
  count: number
  actions: BulkAction[]
  /** "Objavljujem…": set while an action runs; with `done` and `total` it reads "Objavljujem… 12 od 37". */
  running?: { label: string, done: number, total: number }
  /** More records match than are ticked: offers "Odaberi svih N". */
  totalMatching?: number
}>()
const emit = defineEmits<{
  action: [key: string]
  clear: []
  stop: []
  selectAll: []
}>()

/** "Odabran 1 zapis", "Odabrana 3 zapisa", "Odabrano 5 zapisa". */
const countText = computed(() => {
  const form = pluralFormHr(props.count)
  return `${form === 'one' ? 'Odabran' : form === 'few' ? 'Odabrana' : 'Odabrano'} ${props.count} ${nounFor(props.count, ['zapis', 'zapisa', 'zapisa'])}`
})
const progress = computed(() => props.running ? Math.round((props.running.done / Math.max(1, props.running.total)) * 100) : 0)
</script>

<template>
  <div
    v-if="running"
    role="status"
    class="flex flex-wrap items-center gap-3 rounded-lg bg-inverted p-3 text-inverted"
    data-testid="admin-bulk-running"
  >
    <b>{{ running.label }} {{ running.done }} od {{ running.total }}</b>
    <UProgress
      :model-value="progress"
      size="sm"
      class="min-w-24 flex-1"
      :aria-label="running.label"
    />
    <UButton
      label="Zaustavi"
      color="neutral"
      variant="outline"
      class="bg-transparent text-inverted ring-inverted hover:bg-transparent"
      @click="emit('stop')"
    />
  </div>
  <div
    v-else
    role="region"
    aria-label="Skupne radnje"
    class="flex flex-wrap items-center gap-2 rounded-lg bg-inverted p-3 text-inverted"
    data-testid="admin-bulk-bar"
  >
    <b>{{ countText }}</b>
    <UButton
      v-if="totalMatching && totalMatching > count"
      :label="`Odaberi svih ${totalMatching}`"
      color="neutral"
      variant="link"
      class="text-inverted underline"
      data-testid="admin-select-all"
      @click="emit('selectAll')"
    />
    <div class="flex flex-1 flex-wrap items-center gap-2">
      <template
        v-for="action in actions"
        :key="action.key"
      >
        <UDropdownMenu
          v-if="action.items"
          :items="action.items.map(item => ({ label: item.label, onSelect: () => emit('action', `${action.key}:${item.value}`) }))"
        >
          <UButton
            :label="action.label"
            :icon="action.icon"
            trailing-icon="i-lucide-chevron-down"
            color="neutral"
            variant="outline"
            class="bg-transparent text-inverted ring-inverted hover:bg-transparent hover:ring-2"
            :data-testid="`admin-bulk-${action.key}`"
          />
        </UDropdownMenu>
        <UButton
          v-else
          :label="action.label"
          :icon="action.icon"
          color="neutral"
          variant="outline"
          class="bg-transparent text-inverted ring-inverted hover:bg-transparent hover:ring-2"
          :data-testid="`admin-bulk-${action.key}`"
          @click="emit('action', action.key)"
        />
      </template>
    </div>
    <UButton
      icon="i-lucide-x"
      color="neutral"
      variant="ghost"
      class="text-inverted hover:bg-transparent"
      aria-label="Poništi odabir"
      data-testid="admin-bulk-clear"
      @click="emit('clear')"
    />
  </div>
</template>
