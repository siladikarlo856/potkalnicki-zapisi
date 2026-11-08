<script setup lang="ts">
// One choice from a server-searched list (a place, a narrator, a Person, a type's parent …). The value is the row's id,
// or null for no choice; `clearable` adds the button that goes back to none.
const props = defineProps<{
  /** `/api/admin/lookup/:kind`, or `/api/admin/lookup/area`. */
  endpoint: string
  /** The area lookup's scope (`settlement`, `municipality`, `all`). */
  scope?: string
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
}>()
const model = defineModel<string | null>({ default: null })

const { search, items, pending } = useAdminLookup(props.endpoint, { scope: props.scope, selected: () => model.value ? [model.value] : [] })
</script>

<template>
  <USelectMenu
    v-model:search-term="search"
    :model-value="model ?? undefined"
    :items="items"
    value-key="value"
    ignore-filter
    :clear="clearable && !!model"
    :loading="pending"
    :disabled="disabled"
    :placeholder="placeholder ?? 'Odaberi'"
    :search-input="{ placeholder: 'Pretraži…' }"
    class="w-full"
    @update:model-value="(value: string | null | undefined) => model = value || null"
  />
</template>
