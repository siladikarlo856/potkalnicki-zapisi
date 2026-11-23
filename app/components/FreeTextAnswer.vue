<script setup lang="ts">
// A typed answer: the player must recall the word, not recognise it. Enter submits the surrounding form. Comparison
// follows judgeDailyGuess in the caller.
withDefaults(defineProps<{ label: string, hint?: string, disabled?: boolean }>(), { hint: undefined })
const model = defineModel<string>({ default: '' })
const id = useId()
const input = useTemplateRef<{ inputRef?: HTMLInputElement }>('input')
defineExpose({ focus: () => input.value?.inputRef?.focus() })
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label
      :for="id"
      class="text-sm font-semibold text-highlighted"
    >{{ label }}</label>
    <UInput
      :id="id"
      ref="input"
      v-model="model"
      size="xl"
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
      :disabled="disabled"
      :aria-describedby="hint ? `${id}-hint` : undefined"
      :ui="{ base: 'min-h-13 text-lg font-semibold' }"
      data-testid="free-text-input"
    />
    <p
      v-if="hint"
      :id="`${id}-hint`"
      class="text-sm text-muted"
    >
      {{ hint }}
    </p>
  </div>
</template>
