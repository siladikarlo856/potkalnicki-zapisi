<script setup lang="ts">
import type { Area } from '~/types/heritage'
import type { DailyClue } from '~~/shared/utils/dailyWord'
import { describeClue } from '~/utils/dailyClues'

const props = defineProps<{
  /** Only the clues revealed so far, in reveal order. */
  clues: readonly DailyClue[]
  areas: readonly Area[]
}>()

const { t } = useI18n()
const items = computed(() => props.clues.map(clue => describeClue((key, named) => t(key, named ?? {}), clue, props.areas)))
const list = useTemplateRef<HTMLElement>('list')

/** Moves keyboard and screen-reader focus to the newest clue after a wrong guess. */
function focusLatest() {
  const headings = list.value?.querySelectorAll<HTMLElement>('[data-clue]')
  headings?.[headings.length - 1]?.focus()
}
defineExpose({ focusLatest })
</script>

<template>
  <ol
    v-if="clues.length"
    ref="list"
    class="flex flex-col gap-2"
    data-testid="daily-clues"
  >
    <li
      v-for="(item, index) in items"
      :key="index"
      class="rounded-lg bg-elevated px-3 py-2 ring ring-default"
    >
      <h3
        data-clue
        tabindex="-1"
        class="text-sm font-semibold text-highlighted outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
      >
        {{ item.label }}
      </h3>
      <p
        v-if="item.text"
        lang="hr"
        class="mt-1 text-sm italic"
      >
        {{ item.text }}
      </p>
    </li>
  </ol>
</template>
