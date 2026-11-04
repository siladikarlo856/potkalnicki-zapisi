<script setup lang="ts">
import type { HeritageMatchBoard } from '~~/shared/utils/games/heritageMatch'
import { HERITAGE_MATCH_PAIRS } from '~~/shared/utils/games/heritageMatch'

const props = defineProps<{
  board: HeritageMatchBoard
  boardIndex: number
  boardCount: number
}>()
const emit = defineEmits<{ complete: [firstTryScore: number] }>()

const { t } = useI18n()
const locked = ref(new Set<number>())
const tainted = ref(new Set<number>())
const selectedLeft = ref<number | null>(null)
const selectedRight = ref<number | null>(null)
const shake = ref(false)
const wrongFlash = ref(false)

const score = computed(() => {
  let n = 0
  for (const i of locked.value) {
    if (!tainted.value.has(i)) n += 1
  }
  return n
})

watch(() => props.board, () => {
  locked.value = new Set()
  tainted.value = new Set()
  selectedLeft.value = null
  selectedRight.value = null
  shake.value = false
  wrongFlash.value = false
})

function tileClass(pairIndex: number, selected: boolean) {
  const base = 'min-h-12 w-full rounded-lg px-2 py-2 text-left text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
  if (locked.value.has(pairIndex)) {
    return `${base} bg-success/15 text-success ring-1 ring-success/40`
  }
  if (selected) {
    return `${base} bg-primary/15 text-highlighted ring-2 ring-primary`
  }
  return `${base} bg-elevated text-highlighted hover:bg-accented/40`
}

function selectLeft(pairIndex: number) {
  if (locked.value.has(pairIndex)) return
  selectedLeft.value = selectedLeft.value === pairIndex ? null : pairIndex
  tryMatch()
}

function selectRight(pairIndex: number) {
  if (locked.value.has(pairIndex)) return
  selectedRight.value = selectedRight.value === pairIndex ? null : pairIndex
  tryMatch()
}

async function tryMatch() {
  if (selectedLeft.value === null || selectedRight.value === null) return
  const left = selectedLeft.value
  const right = selectedRight.value
  if (left === right) {
    locked.value = new Set([...locked.value, left])
    selectedLeft.value = null
    selectedRight.value = null
    if (locked.value.size >= HERITAGE_MATCH_PAIRS) {
      emit('complete', score.value)
    }
    return
  }
  tainted.value = new Set([...tainted.value, left, right])
  shake.value = true
  wrongFlash.value = true
  selectedLeft.value = null
  selectedRight.value = null
  await new Promise(resolve => setTimeout(resolve, 450))
  shake.value = false
  wrongFlash.value = false
}

defineExpose({ score })
</script>

<template>
  <div
    class="flex flex-col gap-3"
    :data-shake="shake ? 'true' : undefined"
    data-testid="heritage-match-board"
  >
    <p class="text-xs text-muted">
      {{ t('pz.play.matchBoardOf', { i: boardIndex + 1, n: boardCount }) }}
    </p>
    <p
      v-if="wrongFlash"
      role="status"
      class="text-center text-sm font-semibold text-error"
      data-testid="heritage-match-wrong"
    >
      ✗
    </p>
    <div class="grid grid-cols-2 gap-3">
      <div
        class="flex flex-col gap-2"
        data-testid="heritage-match-left"
      >
        <button
          v-for="tile in board.left"
          :key="tile.id"
          type="button"
          :class="tileClass(tile.pairIndex, selectedLeft === tile.pairIndex)"
          :disabled="locked.has(tile.pairIndex)"
          :data-testid="`heritage-match-left-${tile.pairIndex}`"
          @click="selectLeft(tile.pairIndex)"
        >
          <span class="flex items-start gap-2">
            <span
              v-if="locked.has(tile.pairIndex)"
              aria-hidden="true"
            >✓</span>
            <span class="wrap-anywhere">{{ tile.label }}</span>
          </span>
        </button>
      </div>
      <div
        class="flex flex-col gap-2"
        data-testid="heritage-match-right"
      >
        <button
          v-for="tile in board.right"
          :key="tile.id"
          type="button"
          :class="tileClass(tile.pairIndex, selectedRight === tile.pairIndex)"
          :disabled="locked.has(tile.pairIndex)"
          :data-testid="`heritage-match-right-${tile.pairIndex}`"
          @click="selectRight(tile.pairIndex)"
        >
          <span class="flex items-start gap-2">
            <span
              v-if="locked.has(tile.pairIndex)"
              aria-hidden="true"
            >✓</span>
            <span class="wrap-anywhere">{{ tile.label }}</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}
[data-shake='true'] {
  animation: shake 0.35s ease-in-out;
}
</style>
