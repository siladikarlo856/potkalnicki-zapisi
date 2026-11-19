<script setup lang="ts">
import { letterCount, upperFirst } from '~/utils/dailyClues'
// Clues, slots, earlier guesses and the answer field of the word of the day, in one column. Each wrong guess
// reveals the next clue and one more letter; earlier guesses stay visible, dashed and struck through.
const props = defineProps<{
  /** The number of the try being played (1-based). */
  attempt: number
  maxTries: number
  hints: readonly { text: string }[]
  hintTotal: number
  letters: readonly string[]
  guesses: readonly string[]
  /** One sentence for the polite live region after a wrong guess. */
  announcement?: string
}>()
const guess = defineModel<string>({ default: '' })

const field = useTemplateRef<{ focus: () => void }>('field')
const lengthHint = computed(() => {
  const total = props.letters.filter(letter => letter !== ' ' && letter !== '-').length
  return `${upperFirst(letterCount(total))} slova. Možeš pisati i bez kvačica.`
})
defineExpose({ focus: () => field.value?.focus() })
</script>

<template>
  <div
    class="flex flex-col gap-4"
    data-testid="daily-guess"
  >
    <p
      class="text-sm tabular-nums text-muted"
      data-testid="daily-tries"
    >
      Pokušaj {{ attempt }} od {{ maxTries }}
    </p>
    <HintReveal
      :hints="hints"
      :total="hintTotal"
    />
    <LetterSlots :letters="letters" />
    <ul
      v-if="guesses.length"
      class="m-0 flex list-none flex-col gap-1.5 p-0"
      aria-label="Dosadašnji pokušaji"
      data-testid="daily-guesses"
    >
      <li
        v-for="(text, index) in guesses"
        :key="index"
        class="flex min-h-(--pz-tap-min) items-center gap-2.5 rounded-(--pz-radius-md) border-2 border-dashed border-(--ui-text) px-3 py-1.5 font-semibold"
      >
        <UIcon
          name="i-lucide-x"
          class="size-5 shrink-0"
          aria-hidden="true"
        />
        <span
          class="min-w-0 flex-1 wrap-anywhere line-through decoration-[1.5px]"
          lang="hr"
        >{{ text }}</span>
        <span class="text-xs font-bold whitespace-nowrap">Netočno</span>
      </li>
    </ul>
    <p
      class="sr-only"
      role="status"
    >
      {{ announcement }}
    </p>
    <FreeTextAnswer
      ref="field"
      v-model="guess"
      label="Tvoj odgovor"
      :hint="lengthHint"
    />
  </div>
</template>
