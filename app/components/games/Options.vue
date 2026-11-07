<script setup lang="ts">
import type { GameQuestion } from '~~/shared/utils/games/types'

// AnswerOption: the multiple-choice renderer. A list of full-width buttons (not a radio group), at least
// --pz-option-min tall, with a key square (1–4) that also answers on a keyboard. One tap answers. Afterwards every
// option locks (aria-disabled), the right one is revealed and the player's wrong pick stays marked, each with an
// icon, a word and a border change, never colour alone.
const props = defineProps<{
  question: GameQuestion
  /** Index of the option the player picked, or null before answering. */
  selected: number | null
  labelledby?: string
}>()
const emit = defineEmits<{ select: [index: number] }>()
const { t, locale } = useI18n()

const answered = computed(() => props.selected !== null)

type OptionState = 'default' | 'correct' | 'wrong' | 'locked'
function stateOf(index: number): OptionState {
  if (!answered.value) return 'default'
  if (index === props.question.correct) return 'correct'
  if (index === props.selected) return 'wrong'
  return 'locked'
}

function choose(index: number) {
  if (!answered.value) emit('select', index)
}
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
  <ul
    :aria-labelledby="labelledby"
    class="m-0 flex list-none flex-col gap-2 p-0"
    data-testid="game-options"
  >
    <li
      v-for="(option, index) in question.options"
      :key="`${question.id}-${index}`"
    >
      <button
        type="button"
        :data-testid="`game-option-${index}`"
        :data-state="stateOf(index)"
        :aria-pressed="answered ? undefined : 'false'"
        :aria-disabled="answered ? 'true' : undefined"
        class="grid min-h-(--pz-option-min) w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-(--pz-radius-md) text-start text-base transition-colors duration-150 motion-reduce:transition-none"
        :class="{
          'border border-accented bg-default px-4 py-3 text-default': stateOf(index) === 'default',
          'cursor-pointer hover:bg-muted': !answered,
          'cursor-default border border-default bg-muted px-4 py-3 text-muted': stateOf(index) === 'locked',
          'border-2 border-success bg-(--pz-success-soft) px-[15px] py-[11px] text-default': stateOf(index) === 'correct',
          'border-2 border-error bg-(--pz-error-soft) px-[15px] py-[11px] text-default': stateOf(index) === 'wrong'
        }"
        @click="choose(index)"
      >
        <span
          class="grid size-7 place-items-center rounded-(--pz-radius-sm) border text-[13px] leading-none font-semibold"
          :class="{
            'border-default text-dimmed': stateOf(index) === 'default' || stateOf(index) === 'locked',
            'border-success bg-success text-inverted': stateOf(index) === 'correct',
            'border-error bg-error text-inverted': stateOf(index) === 'wrong'
          }"
          aria-hidden="true"
        >{{ index + 1 }}</span>
        <span
          class="min-w-0 wrap-anywhere"
          :lang="lang"
        >{{ option[lang] }}</span>
        <span
          v-if="stateOf(index) === 'correct' || stateOf(index) === 'wrong'"
          class="inline-flex items-center gap-1 text-[13px] leading-[18px] font-semibold whitespace-nowrap"
          :class="stateOf(index) === 'correct' ? 'text-success' : 'text-error'"
          data-testid="game-answer-tag"
        >
          <UIcon
            :name="stateOf(index) === 'correct' ? 'i-lucide-check' : 'i-lucide-x'"
            class="size-4 shrink-0"
          />
          {{ t(stateOf(index) === 'wrong' ? 'pz.play.tagYourAnswer' : selected === index ? 'pz.play.tagCorrect' : 'pz.play.tagCorrectAnswer') }}
        </span>
      </button>
    </li>
  </ul>
</template>
