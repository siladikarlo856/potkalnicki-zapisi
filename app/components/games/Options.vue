<script setup lang="ts">
import type { GameQuestion } from '~~/shared/utils/games/types'

// The multiple-choice renderer: 2–4 option buttons, keys 1–4 select. After an answer the buttons are
// disabled and marked with an icon and text, never colour alone.
const props = defineProps<{
  question: GameQuestion
  /** Index of the option the player picked, or null before answering. */
  selected: number | null
  labelledby?: string
}>()
const emit = defineEmits<{ select: [index: number] }>()
const { t, locale } = useI18n()

const answered = computed(() => props.selected !== null)
const lang = computed(() => locale.value === 'en' ? 'en' : 'hr')

function onKey(event: KeyboardEvent) {
  if (answered.value || event.ctrlKey || event.metaKey || event.altKey) return
  const target = event.target
  if (target instanceof Element && target.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return
  const index = Number(event.key) - 1
  if (Number.isInteger(index) && index >= 0 && index < props.question.options.length) {
    event.preventDefault()
    emit('select', index)
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div
    role="group"
    :aria-labelledby="labelledby"
    class="grid grid-cols-1 gap-2 sm:grid-cols-2"
    data-testid="game-options"
  >
    <UButton
      v-for="(option, index) in question.options"
      :key="`${question.id}-${index}`"
      :data-testid="`game-option-${index}`"
      :disabled="answered"
      :color="answered && index === question.correct ? 'success' : answered && index === selected ? 'error' : 'neutral'"
      :variant="answered && (index === question.correct || index === selected) ? 'subtle' : 'outline'"
      size="lg"
      class="min-h-11 min-w-0 justify-start text-start whitespace-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-100"
      @click="emit('select', index)"
    >
      <span
        class="shrink-0 text-xs opacity-60"
        aria-hidden="true"
      >{{ index + 1 }}.</span>
      <span
        class="min-w-0 wrap-anywhere"
        :lang="lang"
      >{{ option[lang] }}</span>
      <UIcon
        v-if="answered && index === question.correct"
        name="i-lucide-circle-check"
        class="size-4 shrink-0"
      />
      <UIcon
        v-else-if="answered && index === selected"
        name="i-lucide-circle-x"
        class="size-4 shrink-0"
      />
      <span
        v-if="answered && index === question.correct"
        class="sr-only"
      >{{ t('pz.play.correctOption') }}</span>
      <span
        v-if="answered && index === selected && index !== question.correct"
        class="sr-only"
      >{{ t('pz.play.yourAnswer') }}</span>
    </UButton>
  </div>
</template>
