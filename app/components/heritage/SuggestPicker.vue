<script setup lang="ts">
import type { ContentSearchResponse } from '~~/shared/types/publicAtlas'
import type { ContributionKind } from '~~/shared/utils/contribution'

// The "Ispravak" card on /doprinesi: search for what is wrong, then pick it. Heritage items and settlements
// are searched on the server, words in the list the page already loads.
const emit = defineEmits<{ pick: [kind: ContributionKind, id: string] }>()
const { t } = useI18n()
const { words } = useHeritage()

const query = ref('')
const input = useTemplateRef<{ inputRef: HTMLInputElement | null }>('input')
const found = ref<ContentSearchResponse>({ items: [], settlements: [] })
const searching = ref(false)
let request = 0

let timer: ReturnType<typeof setTimeout> | undefined
watch(query, (value) => {
  clearTimeout(timer)
  const current = ++request
  if (value.trim().length < 2) {
    found.value = { items: [], settlements: [] }
    searching.value = false
    return
  }
  searching.value = true
  timer = setTimeout(() => search(value, current), 250)
})
onBeforeUnmount(() => clearTimeout(timer))

async function search(value: string, current: number) {
  try {
    const result = await $fetch<ContentSearchResponse>('/api/content/search', { query: { q: value.trim() } })
    if (current === request) found.value = result
  } catch {
    if (current === request) found.value = { items: [], settlements: [] }
  } finally {
    if (current === request) searching.value = false
  }
}

const foundWords = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (q.length < 2) return []
  return words.value.filter(word => word.headword.toLowerCase().includes(q)).slice(0, 8)
})

const groups = computed(() => [
  { kind: 'heritage_item' as const, rows: found.value.items.map(row => ({ id: row.id, name: row.name, context: row.context })) },
  { kind: 'area' as const, rows: found.value.settlements.map(row => ({ id: row.id, name: row.name, context: row.context })) },
  { kind: 'word' as const, rows: foundWords.value.map(word => ({ id: word.id, name: word.headword, context: word.meaning.hr })) }
].filter(group => group.rows.length))

onMounted(() => input.value?.inputRef?.focus())
</script>

<template>
  <div
    class="flex flex-col gap-4"
    data-testid="suggest-picker"
  >
    <UFormField
      :label="t('heritage.suggest.pickerLabel')"
      :help="t('heritage.suggest.pickerHelp')"
    >
      <UInput
        ref="input"
        v-model="query"
        type="search"
        icon="i-lucide-search"
        :loading="searching"
        autocomplete="off"
        lang="hr"
        class="w-full"
      />
    </UFormField>
    <div
      aria-live="polite"
      class="flex flex-col gap-4"
    >
      <section
        v-for="group in groups"
        :key="group.kind"
      >
        <h3 class="pz-overline mb-1 text-muted">
          {{ t(`heritage.suggest.kinds.${group.kind}`) }}
        </h3>
        <ul class="divide-y divide-default rounded-lg ring ring-default">
          <li
            v-for="row in group.rows"
            :key="row.id"
          >
            <button
              type="button"
              class="flex w-full flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-start text-sm hover:bg-elevated/40 focus-visible:outline-2 focus-visible:outline-primary"
              :data-testid="`suggest-pick-${group.kind}`"
              @click="emit('pick', group.kind, row.id)"
            >
              <span class="font-medium text-highlighted">{{ row.name }}</span>
              <span class="text-muted">{{ row.context }}</span>
            </button>
          </li>
        </ul>
      </section>
      <p
        v-if="query.trim().length >= 2 && !searching && !groups.length"
        class="text-sm text-muted"
      >
        {{ t('heritage.suggest.nothingFound') }}
      </p>
    </div>
  </div>
</template>
