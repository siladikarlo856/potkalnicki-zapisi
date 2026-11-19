<script setup lang="ts">
// FormField of the design system: `UFormField` (label, description under the label, error) with the *neobavezno* marker after
// the label of an optional field and, given `max`, the counter under the control ("142 / 240"), which turns into an error
// only past the limit. Every other attribute goes to `UFormField` unchanged.
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  optional?: boolean
  /** The length of the value, for the counter. */
  count?: number
  max?: number
}>()
defineSlots<{ default?(props: { error?: boolean | string }): unknown }>()

const over = computed(() => props.max !== undefined && (props.count ?? 0) > props.max)
</script>

<template>
  <UFormField v-bind="$attrs">
    <template
      v-if="optional"
      #label="{ label }"
    >
      {{ label }} <span
        class="font-normal text-muted"
        data-testid="admin-field-optional"
      >neobavezno</span>
    </template>
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
    <template
      v-if="max !== undefined"
      #help
    >
      <span
        class="block text-end tabular-nums"
        :class="over ? 'font-bold text-error' : ''"
        data-testid="admin-field-count"
      >{{ count ?? 0 }} / {{ max }}</span>
    </template>
  </UFormField>
</template>
