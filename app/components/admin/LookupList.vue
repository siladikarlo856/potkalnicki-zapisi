<script setup lang="ts">
import { moveEntry, removeEntry } from '~/utils/intangibleForm'

// An ordered list of rows chosen from a server-searched menu (sources, themes, heritage items, authors, words): each
// row can be moved up or down and removed, and the order is what is saved. A row already in the list is not offered again.
const props = defineProps<{
  endpoint: string
  scope?: string
  /** The menu's placeholder, e.g. "Dodaj izvor". */
  placeholder: string
  /** Text under an empty list. */
  empty: string
  /** The most rows the content layer takes. */
  max: number
  /** Names the list for assistive technology: "izvor" → "Pomakni izvor gore". */
  noun: string
}>()
const model = defineModel<string[]>({ default: () => [] })

const { search, items, labelOf, pending } = useAdminLookup(props.endpoint, { scope: props.scope, selected: () => model.value })
const choices = computed(() => items.value.filter(item => !model.value.includes(item.value)))
const full = computed(() => model.value.length >= props.max)

function add(id: string | null | undefined) {
  if (!id || model.value.includes(id) || full.value) return
  model.value = [...model.value, id]
  search.value = ''
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <ol
      v-if="model.length"
      class="flex flex-col gap-1"
    >
      <li
        v-for="(id, index) in model"
        :key="id"
        class="flex items-center gap-2 rounded-md bg-elevated px-2 py-1"
      >
        <span class="w-5 text-right text-xs text-dimmed">{{ index + 1 }}.</span>
        <span class="min-w-0 flex-1 truncate text-sm">{{ labelOf(id) }}</span>
        <UButton
          icon="i-lucide-arrow-up"
          size="xs"
          color="neutral"
          variant="ghost"
          type="button"
          :disabled="index === 0"
          :aria-label="`Pomakni ${noun} gore: ${labelOf(id)}`"
          @click="model = moveEntry(model, index, -1)"
        />
        <UButton
          icon="i-lucide-arrow-down"
          size="xs"
          color="neutral"
          variant="ghost"
          type="button"
          :disabled="index === model.length - 1"
          :aria-label="`Pomakni ${noun} dolje: ${labelOf(id)}`"
          @click="model = moveEntry(model, index, 1)"
        />
        <UButton
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="ghost"
          type="button"
          :aria-label="`Ukloni ${noun}: ${labelOf(id)}`"
          @click="model = removeEntry(model, index)"
        />
      </li>
    </ol>
    <p
      v-else
      class="text-sm text-dimmed"
    >
      {{ empty }}
    </p>
    <USelectMenu
      v-model:search-term="search"
      :model-value="undefined"
      :items="choices"
      value-key="value"
      ignore-filter
      :loading="pending"
      :disabled="full"
      :placeholder="full ? `Najviše ${max}` : placeholder"
      :search-input="{ placeholder: 'Pretraži…' }"
      class="w-full"
      @update:model-value="(value: string | null | undefined) => add(value)"
    />
  </div>
</template>
