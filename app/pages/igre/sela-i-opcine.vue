<script setup lang="ts">
import { gameDefinition } from '~~/shared/utils/games/definitions'
import { mulberry32 } from '~~/shared/utils/games/rng'
import { buildSelaOpcineBoard, SELA_OPCINE_CHIP_COUNT, type SelaOpcineBoard } from '~~/shared/utils/games/selaOpcine'
import type { Difficulty } from '~~/shared/utils/games/types'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const game = gameDefinition('sela-i-opcine')

const { t } = useI18n()
const { recordBest } = useGameScores()
const { pool, status, error, refresh } = useCardPool()
const seed = useState('pz-sela-opcine-seed', () => Math.floor(Math.random() * 4294967296))
const difficulty = ref<Difficulty>('srednje')
const board = shallowRef<SelaOpcineBoard | null>(null)
const phase = ref<'start' | 'play' | 'result'>('start')
const selectedChip = ref<string | null>(null)
const assignments = ref<Record<string, string | null>>({})
const checked = ref(false)
const loading = computed(() => !error.value && (status.value === 'idle' || status.value === 'pending'))
const placeCount = computed(() => pool.value.cards.filter(card => card.kind === 'place').length)
const canStart = computed(() => placeCount.value >= SELA_OPCINE_CHIP_COUNT && pool.value.municipalities.length >= 2)

function newBoard() {
  return buildSelaOpcineBoard(pool.value, difficulty.value, mulberry32(seed.value))
}

function start() {
  const next = newBoard()
  if (!next) return
  board.value = next
  assignments.value = Object.fromEntries(next.chips.map(chip => [chip.id, null]))
  selectedChip.value = null
  checked.value = false
  phase.value = 'play'
}

function restart() {
  seed.value = (seed.value + 1) >>> 0
  phase.value = 'start'
  board.value = null
}

function selectChip(id: string) {
  if (checked.value) return
  selectedChip.value = selectedChip.value === id ? null : id
}

function assignBucket(bucketId: string) {
  if (checked.value || !selectedChip.value || !board.value) return
  assignments.value = { ...assignments.value, [selectedChip.value]: bucketId }
  selectedChip.value = null
}

function chipCorrect(chipId: string): boolean | null {
  if (!checked.value || !board.value) return null
  const chip = board.value.chips.find(c => c.id === chipId)
  if (!chip) return null
  return assignments.value[chipId] === chip.municipalityId
}

const score = computed(() => {
  if (!board.value) return 0
  return board.value.chips.filter(chip => assignments.value[chip.id] === chip.municipalityId).length
})

function verify() {
  if (!board.value || checked.value) return
  checked.value = true
  recordBest(game.id, score.value, SELA_OPCINE_CHIP_COUNT)
  phase.value = 'result'
}

useSeoMeta({
  title: () => t('pz.play.selaTitle'),
  ogTitle: () => `${t('pz.play.selaTitle')} · Potkalnički zapisi`,
  ogDescription: () => t('pz.play.selaDescription'),
  description: () => t('pz.play.selaDescription')
})
const selectedChipName = computed(() => board.value?.chips.find(chip => chip.id === selectedChip.value)?.name)
</script>

<template>
  <UContainer class="py-3 sm:py-5 lg:py-6">
    <div
      class="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-3"
      data-testid="game-sela-opcine"
    >
      <PageHead
        v-if="phase === 'start' || loading || error"
        title="Sela i općine"
        lead="Razvrstaj sela po općinama."
      />

      <div
        v-if="error || loading"
        class="rounded-xl bg-default p-4 ring ring-default"
        role="status"
      >
        <p>{{ t(error ? 'quiz.loadError' : 'quiz.loading') }}</p>
        <UButton
          v-if="error"
          :label="t('quiz.retry')"
          variant="link"
          @click="refresh()"
        />
      </div>
      <div
        v-else-if="placeCount < SELA_OPCINE_CHIP_COUNT"
        class="rounded-xl bg-default p-4 text-center ring ring-default"
        role="status"
      >
        <h2 class="text-xl font-bold text-highlighted">
          {{ t('quiz.emptyTitle') }}
        </h2>
        <p class="mt-1 text-sm text-muted">
          {{ t('quiz.emptyDescription') }}
        </p>
      </div>
      <GamesStart
        v-else-if="phase === 'start'"
        v-model:difficulty="difficulty"
        :game-id="game.id"
        :questions="SELA_OPCINE_CHIP_COUNT"
        :levels="false"
        :instructions="['Dodirni selo, pa općinu u koju ga stavljaš.', 'Pritisni „Provjeri” kad su sva sela razvrstana.']"
        :disabled="!canStart"
        @start="start"
      />
      <template v-else-if="board && phase === 'play'">
        <p class="text-sm text-muted">
          {{ t('pz.play.selaHint') }}
        </p>
        <p
          role="status"
          class="sr-only"
        >
          {{ selectedChipName ? `Odabrano: ${selectedChipName}. Odaberi skupinu.` : '' }}
        </p>
        <div
          class="flex flex-wrap gap-2"
          data-testid="sela-chips"
        >
          <button
            v-for="chip in board.chips"
            :key="chip.id"
            type="button"
            class="inline-flex min-h-11 items-center gap-1.5 rounded-(--pz-radius-md) px-3.5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pz-focus)"
            :class="[
              checked && chipCorrect(chip.id) === false ? 'border-2 border-dashed border-inverted bg-default text-highlighted line-through'
              : checked && chipCorrect(chip.id) ? 'border-2 border-success bg-(--pz-ok-bg) text-highlighted'
                : selectedChip === chip.id ? 'border-2 border-inverted bg-inverted text-inverted'
                  : 'border-[1.5px] border-accented bg-default text-highlighted hover:border-inverted',
              assignments[chip.id] && !checked ? 'opacity-70' : ''
            ]"
            :aria-pressed="selectedChip === chip.id"
            :data-testid="`sela-chip-${chip.id}`"
            @click="selectChip(chip.id)"
          >
            <span>{{ chip.name }}</span>
            <template v-if="checked && chipCorrect(chip.id) !== null">
              <UIcon
                :name="chipCorrect(chip.id) ? 'i-lucide-check' : 'i-lucide-x'"
                class="size-4"
                aria-hidden="true"
              />
              <span class="sr-only">{{ chipCorrect(chip.id) ? 'Točno' : 'Netočno' }}</span>
            </template>
          </button>
        </div>
        <div
          class="grid gap-2"
          :class="board.buckets.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'"
          data-testid="sela-buckets"
        >
          <button
            v-for="bucket in board.buckets"
            :key="bucket.id"
            type="button"
            class="min-h-24 rounded-(--pz-radius-md) border-[1.5px] border-dashed border-accented bg-default p-3 text-start text-base font-bold text-highlighted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pz-focus)"
            :class="selectedChip ? '!border-2 !border-solid !border-inverted bg-elevated' : ''"
            :data-testid="`sela-bucket-${bucket.id}`"
            @click="assignBucket(bucket.id)"
          >
            {{ bucket.label }}
            <span
              v-if="selectedChip"
              class="mt-1 block text-sm font-semibold text-muted"
            >Stavi ovamo</span>
            <ul class="mt-2 space-y-1 text-xs font-normal text-muted">
              <li
                v-for="chip in board.chips.filter(c => assignments[c.id] === bucket.id)"
                :key="chip.id"
              >
                {{ chip.name }}
              </li>
            </ul>
          </button>
        </div>
        <UButton
          :label="t('pz.play.selaCheck')"
          size="xl"
          block
          data-testid="sela-verify"
          @click="verify"
        />
      </template>
      <div
        v-else-if="board && phase === 'result'"
        class="flex flex-col items-center gap-3 rounded-xl bg-default p-4 text-center ring ring-default sm:p-6"
        data-testid="game-result"
      >
        <h2 class="text-xl font-bold text-highlighted">
          {{ t('pz.play.done') }}
        </h2>
        <p
          role="status"
          class="text-lg font-semibold text-highlighted"
          data-testid="game-result-score"
        >
          {{ t('pz.play.resultOf', { correct: score, n: SELA_OPCINE_CHIP_COUNT }) }}
        </p>
        <UButton
          :label="t('pz.play.again')"
          icon="i-lucide-rotate-ccw"
          size="xl"
          block
          data-testid="sela-restart"
          @click="restart"
        />
      </div>
    </div>
  </UContainer>
</template>
