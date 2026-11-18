<script setup lang="ts">
// Search: a role="search" form with a visually hidden label, a leading icon, a clear button once there is text
// (name "Obriši upit") and, on the desktop header, the "/" shortcut hint. Emits `search` after two characters with a
// short delay, and `submit` on Enter (the consumer sends it to /trazi/?q=). The query lives in the address, so the
// consumer owns it through v-model. Matching folds case and diacritics on the server side (skrlak finds škrlak).
const props = withDefaults(defineProps<{
  placeholder?: string
  label?: string
  /** Show the "/" hint (desktop header only). */
  shortcut?: boolean
  /** Number of suggestions currently listed; announced politely ("3 prijedloga"). */
  suggestionCount?: number
  /** Delay in ms before `search` fires. */
  delay?: number
}>(), {
  placeholder: 'Mjesto, građevina, osoba, priča, riječ',
  label: 'Pretraži arhiv',
  delay: 250
})

const emit = defineEmits<{ search: [query: string], submit: [query: string] }>()
const query = defineModel<string>({ default: '' })
const input = useTemplateRef<{ inputRef: HTMLInputElement | null }>('input')

let timer: ReturnType<typeof setTimeout> | undefined
watch(query, (value) => {
  clearTimeout(timer)
  if (value.trim().length < 2) return
  timer = setTimeout(() => emit('search', value.trim()), props.delay)
})
onBeforeUnmount(() => clearTimeout(timer))

function submit() {
  clearTimeout(timer)
  emit('submit', query.value.trim())
}

function clear() {
  query.value = ''
  input.value?.inputRef?.focus()
}

function plural(n: number) {
  return countNoun(n, 'prijedlog', 'prijedloga')
}

// "/" focuses the field from anywhere outside a text field.
function onKey(event: KeyboardEvent) {
  if (!props.shortcut || event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, select, [contenteditable]')) return
  event.preventDefault()
  input.value?.inputRef?.focus()
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <form
    role="search"
    class="min-w-0"
    data-testid="search-field"
    @submit.prevent="submit"
  >
    <label
      class="sr-only"
      :for="`${$.uid}-search`"
    >{{ label }}</label>
    <UInput
      :id="`${$.uid}-search`"
      ref="input"
      v-model="query"
      type="search"
      name="q"
      autocomplete="off"
      enterkeyhint="search"
      icon="i-lucide-search"
      :placeholder="placeholder"
      class="w-full"
      :ui="{ trailing: 'pe-1.5' }"
    >
      <template
        v-if="query || shortcut"
        #trailing
      >
        <UButton
          v-if="query"
          type="button"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          icon="i-lucide-x"
          aria-label="Obriši upit"
          data-testid="search-clear"
          @click="clear"
        />
        <kbd
          v-else
          class="rounded-xs border border-accented px-1.5 text-sm text-muted"
          aria-hidden="true"
        >/</kbd>
      </template>
    </UInput>
    <p
      role="status"
      aria-live="polite"
      class="sr-only"
    >
      <template v-if="suggestionCount !== undefined">
        {{ plural(suggestionCount) }}
      </template>
    </p>
  </form>
</template>
