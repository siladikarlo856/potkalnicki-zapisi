<script setup lang="ts">
// Admin filter bar: search by name, selects (state, verification, place), quick-filter chips (for example
// "Bez licencije"), "Očisti" when any filter is set, and a count at the right (role="status"). Wraps; never hides
// filters in a menu on desktop. Every control has a label, visually hidden where the first option names it.
export interface PzFilterSelect {
  id: string
  label: string
  options: Array<{ value: string, label: string }>
}
export interface PzFilterQuick {
  id: string
  label: string
}
export interface PzFilterValue {
  query: string
  selects: Record<string, string>
  quick: string[]
}

const props = defineProps<{
  selects?: PzFilterSelect[]
  quick?: PzFilterQuick[]
  /** Result count, shown at the right. */
  count?: number
  searchLabel?: string
  /** The search field's placeholder; an example, never the label. */
  searchPlaceholder?: string
  /** Shows the "/" hint and focuses the search from anywhere outside a text field. */
  searchShortcut?: boolean
}>()

const model = defineModel<PzFilterValue>({ default: () => ({ query: '', selects: {}, quick: [] }) })

const ALL = '__all'
const active = computed(() =>
  !!model.value.query.trim()
  || Object.values(model.value.selects).some(v => v && v !== ALL)
  || model.value.quick.length > 0
)

function setQuery(query: string) {
  model.value = { ...model.value, query }
}
function setSelect(id: string, value: string) {
  model.value = { ...model.value, selects: { ...model.value.selects, [id]: value === ALL ? '' : value } }
}
function toggleQuick(id: string) {
  const quick = model.value.quick.includes(id) ? model.value.quick.filter(q => q !== id) : [...model.value.quick, id]
  model.value = { ...model.value, quick }
}
function clear() {
  model.value = { query: '', selects: {}, quick: [] }
}

const noun = computed(() => props.count === undefined ? '' : countNoun(props.count, 'zapis', 'zapisa'))
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-2"
    role="group"
    aria-label="Filtri"
    data-testid="filter-bar"
  >
    <PzSearchField
      :model-value="model.query"
      :label="searchLabel ?? 'Traži po nazivu'"
      :placeholder="searchPlaceholder ?? 'Naziv'"
      :shortcut="searchShortcut"
      class="min-w-48 flex-1 sm:max-w-xs"
      @update:model-value="setQuery"
      @submit="setQuery"
    />
    <USelect
      v-for="select in selects"
      :key="select.id"
      :model-value="model.selects[select.id] || ALL"
      :items="[{ value: ALL, label: select.label }, ...select.options]"
      :aria-label="select.label"
      class="w-auto min-w-40"
      :data-testid="`filter-${select.id}`"
      @update:model-value="setSelect(select.id, String($event))"
    />
    <PzChip
      v-for="chip in quick"
      :key="chip.id"
      :selected="model.quick.includes(chip.id)"
      dense
      @click="toggleQuick(chip.id)"
    >
      {{ chip.label }}
    </PzChip>
    <UButton
      v-if="active"
      color="neutral"
      variant="ghost"
      data-testid="filter-clear"
      @click="clear"
    >
      Očisti
    </UButton>
    <p
      v-if="count !== undefined"
      role="status"
      class="ms-auto text-sm text-muted tabular-nums"
      data-testid="filter-count"
    >
      {{ noun }}
    </p>
  </div>
</template>
