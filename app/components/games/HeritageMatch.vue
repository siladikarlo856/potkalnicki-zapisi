<script setup lang="ts">
import type { HeritageMatchBoard } from '~~/shared/utils/games/heritageMatch'
import { HERITAGE_MATCH_PAIRS } from '~~/shared/utils/games/heritageMatch'

// MatchGroup (pairing): tap to pick, tap to place, no dragging. A correct pair locks in with a check and a word.
// A wrong pair shows a cross and "Nije par" for 600ms and then resets, with no animation under reduced motion
// either. A status line always says what is picked and what to do next. When the board is complete the usual
// feedback summary ("4 od 4 para") appears with an explicit Dalje; the board never moves on by itself.
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
const wrongLeft = ref<number | null>(null)
const wrongRight = ref<number | null>(null)
const status = ref<'idle' | 'right' | 'wrong'>('idle')
const lastPair = ref('')
let resetTimer: ReturnType<typeof setTimeout> | undefined

const FLASH_MS = 600

const score = computed(() => {
  let n = 0
  for (const i of locked.value) {
    if (!tainted.value.has(i)) n += 1
  }
  return n
})
const done = computed(() => locked.value.size >= HERITAGE_MATCH_PAIRS)
const flashing = computed(() => wrongLeft.value !== null)
const last = computed(() => props.boardIndex + 1 >= props.boardCount)
const feedback = useTemplateRef<{ focus: () => void }>('feedback')

const picked = computed(() => {
  const left = props.board.left.find(tile => tile.pairIndex === selectedLeft.value)
  const right = props.board.right.find(tile => tile.pairIndex === selectedRight.value)
  return (left ?? right)?.label ?? ''
})
const statusText = computed(() => {
  if (done.value) return ''
  if (status.value === 'wrong') return t('pz.play.matchWrong')
  if (status.value === 'right') return t('pz.play.matchRight', { name: lastPair.value })
  if (picked.value) return t('pz.play.matchSelected', { name: picked.value })
  return t('pz.play.matchIdle')
})

function clearTimer() {
  if (resetTimer) clearTimeout(resetTimer)
  resetTimer = undefined
}

watch(() => props.board, () => {
  clearTimer()
  locked.value = new Set()
  tainted.value = new Set()
  selectedLeft.value = null
  selectedRight.value = null
  wrongLeft.value = null
  wrongRight.value = null
  status.value = 'idle'
})
onBeforeUnmount(clearTimer)

type TileState = 'default' | 'selected' | 'paired' | 'wrong'
function stateOf(pairIndex: number, selected: number | null, wrong: number | null): TileState {
  if (locked.value.has(pairIndex)) return 'paired'
  if (wrong === pairIndex) return 'wrong'
  if (selected === pairIndex) return 'selected'
  return 'default'
}

const tileClass = (state: TileState) => ({
  'border border-accented bg-default px-3 py-1.5 text-default hover:bg-muted': state === 'default',
  'border-2 border-primary bg-accented px-[11px] py-[5px] text-default': state === 'selected',
  'border border-success bg-(--pz-success-soft) px-3 py-1.5 text-default': state === 'paired',
  'border-2 border-error bg-(--pz-error-soft) px-[11px] py-[5px] text-default': state === 'wrong'
})

function select(side: 'left' | 'right', pairIndex: number) {
  if (flashing.value || done.value || locked.value.has(pairIndex)) return
  const current = side === 'left' ? selectedLeft : selectedRight
  current.value = current.value === pairIndex ? null : pairIndex
  status.value = 'idle'
  tryMatch()
}

function tryMatch() {
  const left = selectedLeft.value
  const right = selectedRight.value
  if (left === null || right === null) return
  if (left === right) {
    lastPair.value = props.board.left.find(tile => tile.pairIndex === left)?.label ?? ''
    locked.value = new Set([...locked.value, left])
    selectedLeft.value = null
    selectedRight.value = null
    status.value = 'right'
    if (done.value) nextTick(() => feedback.value?.focus())
    return
  }
  tainted.value = new Set([...tainted.value, left, right])
  wrongLeft.value = left
  wrongRight.value = right
  status.value = 'wrong'
  selectedLeft.value = null
  selectedRight.value = null
  clearTimer()
  resetTimer = setTimeout(() => {
    wrongLeft.value = null
    wrongRight.value = null
    status.value = 'idle'
    resetTimer = undefined
  }, FLASH_MS)
}

defineExpose({ score })
</script>

<template>
  <div
    class="flex flex-col gap-3"
    data-testid="heritage-match-board"
  >
    <div class="flex items-center justify-between gap-2">
      <p
        class="pz-label text-default"
        data-testid="heritage-match-round"
      >
        {{ t('pz.play.matchBoardOf', { i: boardIndex + 1, n: boardCount }) }}
      </p>
      <p class="text-sm text-muted tabular-nums">
        {{ t('pz.play.matchPairs', { n: locked.size, total: HERITAGE_MATCH_PAIRS }) }}
      </p>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <ul
        v-for="side in (['left', 'right'] as const)"
        :key="side"
        class="m-0 flex list-none flex-col gap-2 p-0"
        :data-testid="`heritage-match-${side}`"
      >
        <li
          v-for="tile in board[side]"
          :key="tile.id"
        >
          <button
            type="button"
            class="flex min-h-(--pz-tap-min) w-full flex-col items-start justify-center gap-0.5 rounded-(--pz-radius-md) text-start text-[15px] leading-5 font-medium transition-colors duration-150 motion-reduce:transition-none"
            :class="tileClass(stateOf(tile.pairIndex, side === 'left' ? selectedLeft : selectedRight, side === 'left' ? wrongLeft : wrongRight))"
            :aria-pressed="locked.has(tile.pairIndex) ? undefined : (side === 'left' ? selectedLeft : selectedRight) === tile.pairIndex"
            :disabled="locked.has(tile.pairIndex)"
            :data-state="stateOf(tile.pairIndex, side === 'left' ? selectedLeft : selectedRight, side === 'left' ? wrongLeft : wrongRight)"
            :data-testid="`heritage-match-${side}-${tile.pairIndex}`"
            @click="select(side, tile.pairIndex)"
          >
            <span class="wrap-anywhere">{{ tile.label }}</span>
            <span
              v-if="locked.has(tile.pairIndex)"
              class="inline-flex items-center gap-1 text-[13px] font-semibold text-success"
            >
              <UIcon
                name="i-lucide-check"
                class="size-4 shrink-0"
              />{{ t('pz.play.matchLocked') }}
            </span>
            <span
              v-else-if="stateOf(tile.pairIndex, side === 'left' ? selectedLeft : selectedRight, side === 'left' ? wrongLeft : wrongRight) === 'wrong'"
              class="inline-flex items-center gap-1 text-[13px] font-semibold text-error"
            >
              <UIcon
                name="i-lucide-x"
                class="size-4 shrink-0"
              />{{ t('pz.play.matchWrongTag') }}
            </span>
          </button>
        </li>
      </ul>
    </div>

    <p
      v-if="!done"
      role="status"
      class="text-sm text-muted"
      data-testid="heritage-match-wrong"
    >
      {{ statusText }}
    </p>

    <GamesFeedback
      v-else
      ref="feedback"
      correct
      :title="t('pz.play.matchDone')"
      :explanation="`${t('pz.play.matchPairs', { n: HERITAGE_MATCH_PAIRS, total: HERITAGE_MATCH_PAIRS })}. ${t('pz.play.matchFirstTry', { n: score })}`"
    />
    <GamesDalje
      v-if="done"
      :last="last"
      @next="emit('complete', score)"
    />
  </div>
</template>
