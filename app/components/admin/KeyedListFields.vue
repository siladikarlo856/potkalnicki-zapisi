<script setup lang="ts">
import { INTANGIBLE_LIST_LIMITS } from '#shared/utils/content/intangibleList'

// The fields of an editor-managed list entry (a type or an occasion): labels, the stable key and the order.
interface KeyedListForm {
  key: string
  labelHr: string
  labelEn: string
  sort: number
}

const props = defineProps<{
  state: KeyedListForm
  /** An example for the key hint, e.g. "legenda-predaja". */
  keyExample: string
}>()
const emit = defineEmits<{ 'update:state': [KeyedListForm] }>()

function patch(partial: Partial<KeyedListForm>) {
  emit('update:state', { ...props.state, ...partial })
}
</script>

<template>
  <AdminFormField
    name="labelHr"
    label="Naziv (hr)"
    required
  >
    <UInput
      :model-value="state.labelHr"
      :maxlength="INTANGIBLE_LIST_LIMITS.labelHr"
      class="w-full"
      autofocus
      @update:model-value="value => patch({ labelHr: String(value) })"
    />
  </AdminFormField>
  <AdminFormField
    name="labelEn"
    label="Naziv (en)"
    optional
  >
    <UInput
      :model-value="state.labelEn"
      :maxlength="INTANGIBLE_LIST_LIMITS.labelEn"
      class="w-full"
      @update:model-value="value => patch({ labelEn: String(value) })"
    />
  </AdminFormField>
  <AdminFormField
    name="key"
    label="Ključ"
    required
    :description="`Stabilni identifikator (mala slova i crtice), npr. ${keyExample}.`"
  >
    <UInput
      :model-value="state.key"
      :maxlength="INTANGIBLE_LIST_LIMITS.key"
      class="w-full font-mono text-sm"
      @update:model-value="value => patch({ key: String(value) })"
    />
  </AdminFormField>
  <AdminFormField
    name="sort"
    label="Redoslijed"
    description="Manji broj ide ranije u izborniku."
  >
    <UInput
      :model-value="state.sort"
      type="number"
      class="w-full"
      @update:model-value="value => patch({ sort: Number(value) || 0 })"
    />
  </AdminFormField>
</template>
