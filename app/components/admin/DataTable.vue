<script setup lang="ts" generic="T extends { id: string }">
// The admin's table (DataTable in the design system): a real table with a caption, `scope` on headers, sortable columns
// whose header holds a button and carries `aria-sort`, a checkbox per row named after the record, and a sticky header.
// Below 768px every row becomes a card: the header is hidden, each cell shows its label from `data-th`, columns marked
// `hideBelow: 'md'` or lower are dropped, and the table never scrolls sideways.
//
// Slots: `#cell-<key>="{ row }"` for a column, `#actions="{ row }"` for the row menu.
export interface DataTableColumn {
  key: string
  label: string
  /** The sort key; the header becomes a button when set. */
  sort?: string
  /** Hidden below this breakpoint (`hidden sm:table-cell`); on a phone card they are dropped. */
  hideBelow?: 'sm' | 'md' | 'lg'
  /** The name cell: bold, a link to the editor. Only the first column is one. */
  main?: boolean
}

const props = defineProps<{
  columns: DataTableColumn[]
  rows: T[]
  /** Names the list and its order, for assistive technology. */
  caption: string
  /** "Naziv" of a row, for checkbox and actions names. */
  rowLabel: (row: T) => string
  /** Current sort, with a leading `-` for descending. */
  sort?: string
  loading?: boolean
  /** Without it, rows have no checkboxes. */
  selectable?: boolean
  /** The editor link of a row's main cell. */
  rowHref?: (row: T) => string | undefined
}>()
const emit = defineEmits<{
  sort: [key: string]
  open: [row: T]
}>()
const selected = defineModel<string[]>('selected', { default: () => [] })

const HIDE = { sm: 'max-sm:hidden', md: 'max-md:hidden', lg: 'max-lg:hidden' } as const
const hideClass = (column: DataTableColumn) => column.hideBelow ? HIDE[column.hideBelow] : ''
// Phone cards drop the low-priority columns (md and lg); `sm` ones stay on a phone as they stay on a small window.
const cardDrop = (column: DataTableColumn) => column.hideBelow === 'md' || column.hideBelow === 'lg' ? 'max-md:hidden' : ''

function ariaSort(column: DataTableColumn) {
  const sort = props.sort
  if (!column.sort || !sort || sort.replace(/^-/, '') !== column.sort) return undefined
  return sort.startsWith('-') ? 'descending' : 'ascending'
}

const sortLabel = computed(() => {
  const key = props.sort?.replace(/^-/, '')
  return key ? (props.columns.find(column => column.sort === key)?.label ?? key) : ''
})

const allOnPage = computed(() => props.rows.length > 0 && props.rows.every(row => selected.value.includes(row.id)))
const someOnPage = computed(() => props.rows.some(row => selected.value.includes(row.id)))

function toggleAll(value: boolean | 'indeterminate') {
  const ids = props.rows.map(row => row.id)
  selected.value = value === true ? [...new Set([...selected.value, ...ids])] : selected.value.filter(id => !ids.includes(id))
}

// Shift-click selects the range from the last ticked row.
let anchor: string | undefined
function toggleRow(row: T, event?: Event) {
  const ids = props.rows.map(item => item.id)
  const turnOn = !selected.value.includes(row.id)
  const shift = event instanceof MouseEvent && event.shiftKey && anchor && ids.includes(anchor)
  const range = shift ? ids.slice(Math.min(ids.indexOf(anchor!), ids.indexOf(row.id)), Math.max(ids.indexOf(anchor!), ids.indexOf(row.id)) + 1) : [row.id]
  selected.value = turnOn ? [...new Set([...selected.value, ...range])] : selected.value.filter(id => !range.includes(id))
  anchor = row.id
}

/** A shift-click is handled here, before the checkbox sees it, so it selects the range instead of toggling one row. */
function onCheckClick(row: T, event: MouseEvent) {
  if (!event.shiftKey) return
  event.stopPropagation()
  event.preventDefault()
  toggleRow(row, event)
}

const SKELETON_ROWS = 6
</script>

<template>
  <div
    class="overflow-x-clip rounded-lg border border-default bg-default"
    data-testid="admin-table"
  >
    <table class="w-full border-collapse text-sm">
      <caption class="sr-only">
        {{ caption }}{{ sortLabel ? `, poredano po: ${sortLabel}` : '' }}
      </caption>
      <thead class="max-md:sr-only">
        <tr>
          <th
            v-if="selectable"
            scope="col"
            class="sticky top-0 z-10 w-11 bg-elevated px-3 py-2 text-start"
          >
            <UCheckbox
              :model-value="allOnPage ? true : someOnPage ? 'indeterminate' : false"
              aria-label="Odaberi sve na ovoj stranici"
              @update:model-value="toggleAll"
            />
          </th>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            :aria-sort="ariaSort(column)"
            class="sticky top-0 z-10 bg-elevated px-3 py-2 text-start text-[0.8125rem] font-bold whitespace-nowrap text-muted aria-[sort=ascending]:text-default aria-[sort=descending]:text-default"
            :class="hideClass(column)"
          >
            <button
              v-if="column.sort"
              type="button"
              class="-mx-1.5 inline-flex min-h-8 items-center gap-1 rounded-sm px-1.5 font-bold hover:text-default"
              :aria-label="`${column.label}: poredaj ${ariaSort(column) === 'ascending' ? 'silazno' : 'uzlazno'}`"
              @click="emit('sort', column.sort)"
            >
              {{ column.label }}
              <UIcon
                :name="ariaSort(column) === 'descending' ? 'i-lucide-arrow-down-wide-narrow' : ariaSort(column) === 'ascending' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-up-down'"
                class="size-4"
                aria-hidden="true"
              />
            </button>
            <template v-else>
              {{ column.label }}
            </template>
          </th>
          <th
            scope="col"
            class="sticky top-0 z-10 w-12 bg-elevated px-3 py-2"
          >
            <span class="sr-only">Radnje</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-if="loading && !rows.length">
          <tr
            v-for="index in SKELETON_ROWS"
            :key="index"
            class="border-t border-default max-md:block max-md:p-3"
            aria-hidden="true"
          >
            <td
              :colspan="columns.length + (selectable ? 2 : 1)"
              class="px-3 py-3 max-md:block max-md:p-0"
            >
              <USkeleton class="h-5 w-full" />
            </td>
          </tr>
        </template>
        <tr
          v-for="row in rows"
          :key="row.id"
          class="border-t border-default hover:bg-muted max-md:grid max-md:grid-cols-[auto_1fr_auto] max-md:items-start max-md:gap-x-2 max-md:p-3"
          :class="{ 'bg-(--pz-primary-soft) hover:bg-(--pz-primary-soft)': selected.includes(row.id) }"
          :aria-selected="selectable ? selected.includes(row.id) : undefined"
        >
          <td
            v-if="selectable"
            class="w-11 px-3 max-md:w-auto max-md:p-0 max-md:pt-0.5"
          >
            <UCheckbox
              :model-value="selected.includes(row.id)"
              :aria-label="`Odaberi: ${rowLabel(row)}`"
              @click.capture="(event: MouseEvent) => onCheckClick(row, event)"
              @update:model-value="toggleRow(row)"
            />
          </td>
          <template
            v-for="column in columns"
            :key="column.key"
          >
            <td
              class="min-h-11 px-3 py-2.5 align-middle max-md:col-span-2 max-md:col-start-2 max-md:flex max-md:gap-2 max-md:p-0 max-md:py-0.5"
              :class="[hideClass(column), cardDrop(column), column.main ? 'min-w-48 whitespace-normal max-md:col-span-1 max-md:col-start-2 max-md:row-start-1 max-md:text-base' : '']"
              :data-th="column.main ? undefined : column.label"
            >
              <span
                v-if="!column.main"
                class="hidden shrink-0 text-muted max-md:inline"
              >{{ column.label }}:</span>
              <slot
                :name="`cell-${column.key}`"
                :row="row"
              >
                <NuxtLink
                  v-if="column.main && rowHref?.(row)"
                  :to="rowHref(row)"
                  class="font-bold text-highlighted no-underline hover:underline"
                  @click.prevent="emit('open', row)"
                >
                  {{ (row as Record<string, unknown>)[column.key] }}
                </NuxtLink>
                <button
                  v-else-if="column.main"
                  type="button"
                  class="text-start font-bold text-highlighted hover:underline"
                  @click="emit('open', row)"
                >
                  {{ (row as Record<string, unknown>)[column.key] }}
                </button>
                <span v-else>{{ (row as Record<string, unknown>)[column.key] ?? '—' }}</span>
              </slot>
            </td>
          </template>
          <td class="w-12 px-3 py-1 text-end max-md:col-start-3 max-md:row-start-1 max-md:w-auto max-md:p-0">
            <slot
              name="actions"
              :row="row"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
