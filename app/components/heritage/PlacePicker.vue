<script setup lang="ts">
import type { PlaceOption, PlaceSearchResponse } from '../../../shared/types/place'

const props = defineProps<{ required?: boolean }>()
const placeId = defineModel<string | null>({ required: true })
const query = defineModel<string>('query', { required: true })
const emit = defineEmits<{ selection: [id: string | null] }>()
const { t } = useI18n()
const placeText = (key: 'error' | 'empty' | 'clear') => t(`heritage.${props.required ? 'variantDialog.places' : 'places'}.${key}`)
const input = useTemplateRef('input')
const listboxId = `places-${useId()}`
const selected = ref<PlaceOption | null>(null)
const results = ref<PlaceOption[]>([])
const open = ref(false)
const activeIndex = ref(-1)
const loading = ref(false)
const failed = ref(false)
const searched = ref(false)
let writingLabel = false
let generation = 0
let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined

function optionId(index: number) {
  return `${listboxId}-${index}`
}

function cancel() {
  generation++
  clearTimeout(timer)
  controller?.abort()
  loading.value = false
}

async function search() {
  cancel()
  const current = generation
  const q = query.value.trim()
  if (q.length < 2 || selected.value) return
  loading.value = true
  failed.value = false
  controller = new AbortController()
  try {
    const response = await $fetch<PlaceSearchResponse>('/api/places', { query: { q }, signal: controller.signal, retry: 0 })
    if (current !== generation) return
    results.value = response.places
    activeIndex.value = response.places.length ? 0 : -1
    searched.value = true
  } catch {
    if (current === generation) failed.value = true
  } finally {
    if (current === generation) loading.value = false
  }
}

function edited(value: string | number | null | undefined) {
  if (writingLabel) return
  const text = String(value ?? '')
  query.value = text
  if (selected.value && text !== selected.value.name) {
    selected.value = null
    placeId.value = null
  }
  open.value = true
  if (selected.value) return
  cancel()
  results.value = []
  activeIndex.value = -1
  failed.value = false
  searched.value = false
  if (text.trim().length >= 2) {
    loading.value = true
    timer = setTimeout(search, 250)
  }
}

function retry() {
  input.value?.inputRef?.focus()
  open.value = true
  search()
}

function choose(place: PlaceOption) {
  cancel()
  selected.value = place
  placeId.value = place.id
  emit('selection', place.id)
  writingLabel = true
  query.value = place.name
  nextTick(() => {
    writingLabel = false
  })
  open.value = false
}

function clear() {
  cancel()
  emit('selection', null)
  selected.value = null
  placeId.value = null
  query.value = ''
  results.value = []
  activeIndex.value = -1
  failed.value = false
  searched.value = false
  open.value = false
  nextTick(() => {
    input.value?.inputRef?.focus()
    open.value = false
  })
}

function keydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Escape') {
    event.preventDefault()
    open.value = false
    return
  }
  if (event.key === 'Enter') {
    const place = results.value[activeIndex.value]
    if (open.value && place) {
      event.preventDefault()
      choose(place)
    }
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const wasOpen = open.value
    open.value = true
    const count = results.value.length
    if (count) {
      activeIndex.value = !wasOpen || activeIndex.value < 0
        ? event.key === 'ArrowDown' ? 0 : count - 1
        : (activeIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
    }
  } else if (open.value && results.value.length && (event.key === 'Home' || event.key === 'End')) {
    event.preventDefault()
    activeIndex.value = event.key === 'Home' ? 0 : results.value.length - 1
  } else return
  nextTick(() => document.getElementById(optionId(activeIndex.value))?.scrollIntoView({ block: 'nearest' }))
}

watch(placeId, (value) => {
  if (!value && selected.value) clear()
})
onScopeDispose(cancel)
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="relative">
      <UInput
        ref="input"
        :model-value="query"
        :loading="loading"
        :placeholder="t('heritage.form.placePlaceholder')"
        :maxlength="80"
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        :aria-expanded="open"
        :aria-controls="open ? listboxId : undefined"
        :aria-activedescendant="open && activeIndex >= 0 && results[activeIndex] ? optionId(activeIndex) : undefined"
        :aria-busy="loading"
        icon="i-lucide-map-pin"
        autocomplete="off"
        class="w-full"
        @update:model-value="edited"
        @focus="open = true"
        @blur="open = false"
        @keydown="keydown"
      />
      <div
        v-if="open"
        :id="listboxId"
        role="listbox"
        :aria-label="t('heritage.places.listLabel')"
        class="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md bg-default p-1 shadow-lg ring ring-default"
        @mousedown.prevent
      >
        <p
          v-if="!results.length"
          class="px-3 py-2 text-sm text-muted"
        >
          {{ loading ? t('heritage.places.loading') : failed ? placeText('error') : query.trim().length < 2 ? t('heritage.places.minimum') : placeText('empty') }}
        </p>
        <div
          v-for="(place, index) in results"
          :id="optionId(index)"
          :key="place.id"
          role="option"
          :aria-selected="activeIndex === index"
          class="cursor-pointer rounded-sm px-3 py-2 text-sm"
          :class="activeIndex === index ? 'bg-elevated' : ''"
          @pointermove="activeIndex = index"
          @click="choose(place)"
        >
          <span class="block text-highlighted">{{ place.name }}</span>
          <span class="block text-muted">{{ place.municipality }} · {{ place.county }}</span>
        </div>
      </div>
    </div>

    <div
      aria-live="polite"
      aria-atomic="true"
      class="text-sm"
    >
      <p
        v-if="selected"
        class="text-primary"
      >
        {{ t('heritage.places.selected') }}: {{ selected.name }} · {{ selected.municipality }} · {{ selected.county }}
      </p>
      <p
        v-else-if="loading"
        class="text-muted"
      >
        {{ t('heritage.places.loading') }}
      </p>
      <p
        v-else-if="failed"
        class="text-error"
      >
        {{ placeText('error') }}
      </p>
      <p
        v-else-if="searched && !results.length"
        class="text-muted"
      >
        {{ placeText('empty') }}
      </p>
      <span
        v-else-if="searched"
        class="sr-only"
      >{{ t('heritage.places.results', { count: results.length }) }}</span>
    </div>
    <div
      v-if="query || placeId"
      class="flex flex-wrap gap-2"
    >
      <UButton
        v-if="failed"
        :label="t('heritage.places.retry')"
        color="neutral"
        variant="subtle"
        size="xs"
        @click="retry"
      />
      <UButton
        :label="placeText('clear')"
        color="neutral"
        variant="ghost"
        size="xs"
        @click="clear"
      />
    </div>
    <p class="text-xs text-muted">
      {{ t('heritage.places.data') }}
      <a
        href="https://www.geonames.org/"
        class="underline"
      >GeoNames</a> (<a
        href="https://creativecommons.org/licenses/by/4.0/"
        class="underline"
      >CC BY 4.0</a>),
      <a
        href="https://geoportal.dgu.hr/services/atom/au/xml"
        class="underline"
      >DGU</a> (<a
        href="https://data.gov.hr/otvorena-dozvola"
        class="underline"
      >{{ t('heritage.places.license') }}</a>).
      {{ t('heritage.places.adapted') }}
    </p>
  </div>
</template>
