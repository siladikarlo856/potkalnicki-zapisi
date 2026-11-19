<script setup lang="ts">
import type { GameQuestion } from '~~/shared/utils/games/types'

// AnswerOption: the multiple-choice renderer, a radio group of full-width options (56px or more) with a letter key
// (A–D). Activating one emits `select`; whether that checks the answer at once or only marks it (the round shell
// waits for "Provjeri") is the parent's decision. A marked option is ink-filled. After checking every option locks
// (aria-disabled, same look), the right one is green with a check and the player's wrong pick is a dashed, struck-
// through outline with a cross, each with a word: never colour alone, and never the error red.
const props = defineProps<{
  question: GameQuestion
  /** Index of the option the answer was checked with, or null before checking. */
  selected: number | null
  /** Index of the option marked but not yet checked. */
  pending?: number | null
  labelledby?: string
}>()
const emit = defineEmits<{ select: [index: number], submit: [] }>()
const { locale } = useI18n()

const answered = computed(() => props.selected !== null)
const lang = computed(() => locale.value === 'en' ? 'en' : 'hr')
const KEYS = ['A', 'B', 'C', 'D']
const root = useTemplateRef<HTMLElement>('root')

type OptionState = 'default' | 'chosen' | 'correct' | 'wrong' | 'locked'
function stateOf(index: number): OptionState {
  if (!answered.value) return props.pending === index ? 'chosen' : 'default'
  if (index === props.question.correct) return 'correct'
  if (index === props.selected) return 'wrong'
  return 'locked'
}
const verdict = (index: number) => stateOf(index) === 'wrong' ? 'Netočno' : props.selected === index ? 'Točno' : 'Točan odgovor'

function choose(index: number) {
  if (!answered.value) emit('select', index)
}

const tabbable = computed(() => props.pending ?? 0)

async function onOptionKey(event: KeyboardEvent, index: number) {
  if (answered.value) return
  const last = props.question.options.length - 1
  const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0
  if (step) {
    event.preventDefault()
    const next = index + step < 0 ? last : index + step > last ? 0 : index + step
    if (props.pending !== undefined) emit('select', next)
    await nextTick()
    root.value?.querySelector<HTMLElement>(`[data-testid="game-option-${next}"]`)?.focus()
  } else if (event.key === 'Enter' && props.pending !== null && props.pending !== undefined) {
    event.preventDefault()
    emit('submit')
  }
}

function onKey(event: KeyboardEvent) {
  if (answered.value || event.ctrlKey || event.metaKey || event.altKey) return
  const target = event.target
  if (target instanceof Element && target.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return
  const digit = Number(event.key)
  const index = Number.isInteger(digit) && digit >= 1 && digit <= 4
    ? digit - 1
    : KEYS.indexOf(event.key.toUpperCase())
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
    ref="root"
    role="radiogroup"
    :aria-labelledby="labelledby"
    class="flex flex-col gap-2.5"
    data-testid="game-options"
  >
    <button
      v-for="(option, index) in question.options"
      :key="`${question.id}-${index}`"
      type="button"
      role="radio"
      :aria-checked="stateOf(index) === 'chosen' || stateOf(index) === 'wrong' || (stateOf(index) === 'correct' && selected === index)"
      :aria-disabled="answered ? 'true' : undefined"
      :tabindex="answered ? -1 : pending === undefined || index === tabbable ? 0 : -1"
      :data-testid="`game-option-${index}`"
      :data-state="stateOf(index)"
      class="grid min-h-(--pz-option-min) w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-(--pz-radius-md) px-4 py-3 text-start text-base transition-colors duration-150 motion-reduce:transition-none"
      :class="{
        'border-[1.5px] border-accented bg-default text-default': stateOf(index) === 'default' || stateOf(index) === 'locked',
        'cursor-pointer hover:border-inverted': !answered,
        'cursor-default': answered,
        'border-2 border-inverted bg-elevated px-[15px] py-[11px] text-default': stateOf(index) === 'chosen',
        'border-2 border-success bg-(--pz-ok-bg) px-[15px] py-[11px] text-default': stateOf(index) === 'correct',
        'border-2 border-dashed border-inverted bg-default px-[15px] py-[11px] text-default': stateOf(index) === 'wrong'
      }"
      @click="choose(index)"
      @keydown="onOptionKey($event, index)"
    >
      <span
        class="grid size-7 place-items-center rounded-full border-[1.5px] text-[13px] leading-none font-bold"
        :class="{
          'border-accented text-muted': stateOf(index) === 'default' || stateOf(index) === 'locked',
          'border-inverted bg-inverted text-inverted': stateOf(index) === 'chosen',
          'border-success bg-success text-inverted': stateOf(index) === 'correct',
          'border-inverted text-highlighted': stateOf(index) === 'wrong'
        }"
        aria-hidden="true"
      >
        <UIcon
          v-if="stateOf(index) === 'correct' || stateOf(index) === 'wrong'"
          :name="stateOf(index) === 'correct' ? 'i-lucide-check' : 'i-lucide-x'"
          class="size-4"
        />
        <template v-else>{{ KEYS[index] }}</template>
      </span>
      <span
        class="min-w-0 wrap-anywhere"
        :class="{ 'line-through': stateOf(index) === 'wrong' }"
        :lang="lang"
      >{{ option[lang] }}</span>
      <span
        v-if="stateOf(index) === 'correct' || stateOf(index) === 'wrong'"
        class="text-[13px] leading-[18px] font-bold whitespace-nowrap"
        :class="stateOf(index) === 'correct' ? 'text-success' : 'text-highlighted'"
        data-testid="game-answer-tag"
      >{{ verdict(index) }}</span>
    </button>
  </div>
</template>
