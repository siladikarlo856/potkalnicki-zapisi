<script setup lang="ts">
import type { PzNoun } from '~/utils/pzText'
// The strip above a list: the count ("143 zapisa", role="status", never hidden), the "Filteri" button with a
// count badge below 1024px, the sort select, and the active filters as removable chips with "Očisti sve" at every
// width. From 1024px the `rail` slot (groups of choices) is always visible beside the list; below, the consumer opens
// its sheet on `open-filters`. Filters and sort live in the address: the consumer owns them.
export interface PzActiveFilter {
  id: string
  label: string
}

const props = defineProps<{
  count: number
  /** The noun that is counted, inflected (default zapis, zapisa). */
  noun?: PzNoun
  sortOptions?: Array<{ value: string, label: string }>
  activeFilters?: PzActiveFilter[]
}>()

const emit = defineEmits<{ 'open-filters': [], 'remove': [id: string], 'clear': [] }>()
const sort = defineModel<string>('sort')

const countText = computed(() => `${props.count} ${nounFor(props.count, props.noun ?? ['zapis', 'zapisa'])}`)
const activeCount = computed(() => props.activeFilters?.length ?? 0)
</script>

<template>
  <div
    class="flex min-w-0 flex-col gap-3"
    data-testid="list-toolbar"
  >
    <div class="flex flex-wrap items-center gap-3">
      <p
        role="status"
        class="me-auto font-bold tabular-nums"
        data-testid="toolbar-count"
      >
        {{ countText }}
      </p>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-sliders-horizontal"
        class="lg:hidden"
        data-testid="toolbar-filters"
        @click="emit('open-filters')"
      >
        Filteri
        <PzBadge
          :count="activeCount"
          :noun="['aktivni filtar', 'aktivna filtra', 'aktivnih filtara']"
        />
      </UButton>
      <USelect
        v-if="sortOptions?.length"
        v-model="sort"
        :items="sortOptions"
        aria-label="Poredaj"
        class="w-auto min-w-44"
        data-testid="toolbar-sort"
      />
    </div>
    <ul
      v-if="activeCount"
      class="m-0 flex list-none flex-wrap items-center gap-2 p-0"
      aria-label="Aktivni filtri"
    >
      <li
        v-for="filter in activeFilters"
        :key="filter.id"
      >
        <PzChip
          removable
          dense
          @click="emit('remove', filter.id)"
        >
          {{ filter.label }}
        </PzChip>
      </li>
      <li>
        <UButton
          color="neutral"
          variant="ghost"
          data-testid="toolbar-clear"
          @click="emit('clear')"
        >
          Očisti sve
        </UButton>
      </li>
    </ul>
    <div
      v-if="$slots.rail"
      class="hidden lg:block"
      data-testid="toolbar-rail"
    >
      <slot name="rail" />
    </div>
  </div>
</template>
