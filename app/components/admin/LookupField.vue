<script setup lang="ts">
// LookupField of the design system: a labelled relation to one row, chosen from a server search (AdminLookupSelect). The
// value is the row's id, or null for none. Label, description and the rest go to AdminFormField.
defineOptions({ inheritAttrs: false })
defineProps<{
  endpoint: string
  scope?: string
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  optional?: boolean
}>()
const model = defineModel<string | null>({ default: null })
</script>

<template>
  <AdminFormField
    v-bind="$attrs"
    :optional="optional"
  >
    <AdminLookupSelect
      v-model="model"
      :endpoint="endpoint"
      :scope="scope"
      :placeholder="placeholder"
      :clearable="clearable"
      :disabled="disabled"
    />
  </AdminFormField>
</template>
