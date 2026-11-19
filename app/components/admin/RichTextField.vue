<script setup lang="ts">
// RichTextField of the design system for the long texts of a record (a description, a told text). The stored value stays
// plain text, so it is a multi-line field with the counter; the toolbar of the design waits for a decision on the stored
// format (docs/admin-editor-fields.md). Label, description and the rest go to AdminFormField.
defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{
  maxlength: number
  rows?: number
  lang?: string
  placeholder?: string
  optional?: boolean
}>(), { rows: 4, lang: undefined, placeholder: undefined })
const model = defineModel<string>({ default: '' })
</script>

<template>
  <AdminFormField
    v-bind="$attrs"
    :optional="optional"
    :count="model.length"
    :max="maxlength"
  >
    <UTextarea
      v-model="model"
      :maxlength="maxlength"
      :rows="rows"
      :lang="lang"
      :placeholder="placeholder"
      autoresize
      class="w-full"
    />
  </AdminFormField>
</template>
