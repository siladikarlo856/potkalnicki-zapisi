<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: string
  busy?: boolean
  error?: string
  label?: string
  hint?: string
}>(), {
  busy: false,
  error: '',
  label: 'Kôd izazova',
  hint: 'Kôd ima 16 znakova (slova, brojke, - i _). Velika i mala slova su važna.'
})

const emit = defineEmits<{ 'update:modelValue': [value: string], 'submit': [] }>()

const value = computed({
  get: () => props.modelValue,
  set: (next: string) => emit('update:modelValue', next)
})
</script>

<template>
  <UFormField
    :label="label"
    :help="hint"
    :error="error || undefined"
    :ui="{ help: 'text-sm text-muted', error: 'text-sm' }"
  >
    <form
      class="flex flex-col gap-2 sm:flex-row sm:items-start"
      @submit.prevent="emit('submit')"
    >
      <UInput
        v-model="value"
        class="min-w-0 flex-1 tracking-[0.16em] tabular-nums"
        placeholder="npr. aB3dEfGhIjK-_nO2"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        :aria-invalid="Boolean(error)"
        data-testid="challenge-code-input"
      />
      <UButton
        type="submit"
        color="neutral"
        variant="outline"
        :loading="busy"
        class="shrink-0"
        data-testid="challenge-code-submit"
      >
        Pridruži se
      </UButton>
    </form>
  </UFormField>
</template>
