<script setup lang="ts">
import type { Difficulty } from '~~/shared/utils/games/types'

// The start screen of a game: pick Lako / Srednje / Teško (default Srednje) and press "Kreni".
const difficulty = defineModel<Difficulty>('difficulty', { default: 'srednje' })
defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ start: [] }>()
const { t } = useI18n()

const levels: { id: Difficulty, label: string }[] = [
  { id: 'lako', label: 'pz.play.easy' },
  { id: 'srednje', label: 'pz.play.medium' },
  { id: 'tesko', label: 'pz.play.hard' }
]

function onKey(event: KeyboardEvent, current: number) {
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (!step) return
  event.preventDefault()
  const next = levels[(current + step + levels.length) % levels.length]!
  difficulty.value = next.id
  nextTick(() => (event.currentTarget as HTMLElement | null)?.parentElement?.querySelector<HTMLElement>(`[data-level="${next.id}"]`)?.focus())
}
</script>

<template>
  <div
    class="flex flex-col gap-3 rounded-xl bg-default p-4 ring ring-default sm:p-5"
    data-testid="game-start"
  >
    <p
      id="game-difficulty-label"
      class="text-sm font-semibold text-highlighted"
    >
      {{ t('pz.play.difficulty') }}
    </p>
    <div
      role="radiogroup"
      aria-labelledby="game-difficulty-label"
      class="grid grid-cols-3 gap-1 rounded-lg bg-elevated p-1"
    >
      <button
        v-for="(level, i) in levels"
        :key="level.id"
        type="button"
        role="radio"
        :aria-checked="difficulty === level.id"
        :tabindex="difficulty === level.id ? 0 : -1"
        :data-level="level.id"
        :data-testid="`game-level-${level.id}`"
        class="min-h-11 rounded-md px-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :class="difficulty === level.id ? 'bg-primary text-inverted shadow-sm' : 'text-muted hover:text-highlighted'"
        @click="difficulty = level.id"
        @keydown="onKey($event, i)"
      >
        {{ t(level.label) }}
      </button>
    </div>
    <UButton
      :label="t('pz.play.start')"
      icon="i-lucide-play"
      size="xl"
      block
      :disabled="disabled"
      data-testid="game-start-button"
      @click="emit('start')"
    />
  </div>
</template>
