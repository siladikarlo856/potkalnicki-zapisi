<script setup lang="ts">
import {
  buildGroupingPuzzle,
  dailyGroupingSeed,
  evaluateGroupingGuess,
  groupingModeAvailable,
  groupingShareEmoji,
  hashDaySeed,
  pickGroupingMode,
  type GroupingGroup,
  type GroupingMode,
  type GroupingPuzzle,
  type GroupingTile
} from '~~/shared/utils/games/grouping'
import { mulberry32, shuffled } from '~~/shared/utils/games/rng'
import { zagrebDay } from '~~/shared/utils/dailyWord'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const GROUP_BAND = [
  'bg-emerald-600 text-white',
  'bg-sky-600 text-white',
  'bg-amber-500 text-neutral-900',
  'bg-violet-600 text-white'
] as const

const { t } = useI18n()
const { pool, status, error, refresh } = useCardPool()
const loading = computed(() => !error.value && (status.value === 'idle' || status.value === 'pending'))

const daily = ref(true)
const puzzle = shallowRef<GroupingPuzzle | null>(null)
const selected = ref<string[]>([])
const solved = ref<GroupingGroup[]>([])
const lives = ref(4)
const feedback = ref<'almost' | 'wrong' | null>(null)
const finished = ref(false)
const won = computed(() => solved.value.length === 4)
const attempts = ref(0)

const unsolvedTiles = computed(() => {
  const p = puzzle.value
  if (!p) return [] as GroupingTile[]
  const solvedIds = new Set(solved.value.flatMap(g => g.tileIds))
  return p.tiles.filter(tile => !solvedIds.has(tile.id))
})

function resolveDailyMode(): GroupingMode | null {
  if (!pool.value) return null
  const wordsOk = groupingModeAvailable(pool.value, 'words')
  const placesOk = groupingModeAvailable(pool.value, 'places')
  if (wordsOk && placesOk) return hashDaySeed(zagrebDay(new Date())) % 2 === 0 ? 'words' : 'places'
  if (wordsOk) return 'words'
  if (placesOk) return 'places'
  return null
}

function loadPuzzle(randomSeed?: number) {
  if (!pool.value) return
  let mode: GroupingMode | null
  let seed: number
  if (randomSeed !== undefined) {
    daily.value = false
    mode = pickGroupingMode(pool.value, mulberry32(randomSeed))
    seed = randomSeed
  } else if (daily.value) {
    mode = resolveDailyMode()
    seed = mode ? dailyGroupingSeed(zagrebDay(new Date()), mode) : 0
  } else {
    mode = pickGroupingMode(pool.value, mulberry32(Math.floor(Math.random() * 4294967296)))
    seed = Math.floor(Math.random() * 4294967296)
  }
  if (!mode) {
    puzzle.value = null
    return
  }
  puzzle.value = buildGroupingPuzzle(pool.value, mode, seed)
  selected.value = []
  solved.value = []
  lives.value = 4
  feedback.value = null
  finished.value = false
  attempts.value = 0
}

watch(() => pool.value.cards, () => loadPuzzle(), { immediate: true })

function toggleTile(id: string) {
  if (finished.value || won.value) return
  feedback.value = null
  if (selected.value.includes(id)) {
    selected.value = selected.value.filter(item => item !== id)
    return
  }
  if (selected.value.length >= 4) return
  selected.value = [...selected.value, id]
}

function clearSelection() {
  selected.value = []
  feedback.value = null
}

function shuffleTiles() {
  const p = puzzle.value
  if (!p || finished.value) return
  const solvedIds = new Set(solved.value.flatMap(g => g.tileIds))
  const remaining = p.tiles.filter(tile => !solvedIds.has(tile.id))
  const rng = mulberry32((p.seed + attempts.value + 1) >>> 0)
  puzzle.value = {
    ...p,
    tiles: [...p.tiles.filter(tile => solvedIds.has(tile.id)), ...shuffled(remaining, rng)]
  }
}

function submitGuess() {
  const p = puzzle.value
  if (!p || selected.value.length !== 4 || finished.value) return
  attempts.value += 1
  const result = evaluateGroupingGuess(p, selected.value)
  if (result === 'correct') {
    const group = p.groups.find(g => g.tileIds.every(id => selected.value.includes(id)))
    if (group) solved.value = [...solved.value, group]
    selected.value = []
    feedback.value = null
    if (solved.value.length === 4) finished.value = true
    return
  }
  lives.value -= 1
  feedback.value = result === 'one-away' ? 'almost' : 'wrong'
  selected.value = []
  if (lives.value <= 0) finished.value = true
}

function newRandomGame() {
  daily.value = false
  loadPuzzle(Math.floor(Math.random() * 4294967296))
}

function playDaily() {
  daily.value = true
  loadPuzzle()
}

const shareText = computed(() => {
  const p = puzzle.value
  if (!p || !won.value) return ''
  const headline = `${t('pz.play.groupTitle')} · ${t('pz.play.groupAttempts', { n: attempts.value })}`
  return `${headline}\n${groupingShareEmoji(p)}`
})

async function copyShare() {
  if (!shareText.value || !import.meta.client) return
  try {
    await navigator.clipboard.writeText(shareText.value)
  } catch {
    // clipboard may be unavailable
  }
}

useSeoMeta({
  title: () => t('pz.play.groupTitle'),
  ogTitle: () => `${t('pz.play.groupTitle')} · Potkalnički zapisi`,
  description: () => t('pz.play.groupSubtitle')
})
</script>

<template>
  <UContainer class="py-3 sm:py-5 lg:py-6">
    <div class="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-3">
      <header>
        <p class="mb-1 text-xs font-semibold text-primary">
          {{ t('pz.play.groupTitle') }}
        </p>
        <h1 class="text-2xl font-bold tracking-tight text-highlighted sm:text-3xl">
          {{ t('pz.play.groupSubtitle') }}
        </h1>
        <p
          v-if="puzzle"
          class="mt-1 text-xs text-muted"
        >
          {{ puzzle.mode === 'words' ? t('pz.play.groupModeWords') : t('pz.play.groupModePlaces') }}
          · {{ daily ? t('pz.play.groupDaily') : t('pz.play.groupNewGame') }}
        </p>
      </header>

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
        v-else-if="!puzzle"
        class="rounded-xl bg-default p-4 text-center ring ring-default"
        role="status"
      >
        <p class="text-sm text-muted">
          {{ t('pz.play.emptyGeneric') }}
        </p>
      </div>

      <template v-else>
        <p class="text-sm text-muted">
          {{ t('pz.play.groupAttempts', { n: lives }) }}
        </p>

        <div class="flex flex-col gap-2">
          <div
            v-for="group in solved"
            :key="group.id"
            class="rounded-lg px-3 py-2 text-center text-sm font-semibold"
            :class="GROUP_BAND[group.colorIndex]"
          >
            {{ group.label }}
          </div>
        </div>

        <div
          class="grid grid-cols-2 gap-2 sm:grid-cols-4"
          data-testid="grouping-grid"
        >
          <button
            v-for="tile in unsolvedTiles"
            :key="tile.id"
            type="button"
            class="min-h-14 rounded-lg bg-default px-2 py-3 text-center text-sm font-semibold wrap-anywhere ring ring-default transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :class="selected.includes(tile.id) ? 'ring-2 ring-primary bg-primary/10' : ''"
            :aria-pressed="selected.includes(tile.id)"
            data-testid="grouping-tile"
            @click="toggleTile(tile.id)"
          >
            {{ tile.label }}
          </button>
        </div>

        <UAlert
          v-if="feedback === 'almost'"
          :title="t('pz.play.groupAlmost')"
          color="warning"
          variant="subtle"
        />
        <UAlert
          v-else-if="feedback === 'wrong'"
          :title="t('pz.play.wrong')"
          color="error"
          variant="subtle"
        />

        <div
          v-if="!finished"
          class="flex flex-col gap-2 print:hidden"
        >
          <UButton
            :label="t('pz.play.groupCheck')"
            size="lg"
            block
            :disabled="selected.length !== 4"
            data-testid="grouping-check"
            @click="submitGuess"
          />
          <div class="flex flex-wrap gap-2">
            <UButton
              :label="t('pz.play.groupClear')"
              color="neutral"
              variant="soft"
              @click="clearSelection"
            />
            <UButton
              :label="t('pz.play.groupShuffle')"
              color="neutral"
              variant="soft"
              @click="shuffleTiles"
            />
          </div>
        </div>

        <section
          v-else
          class="rounded-xl bg-default p-4 ring ring-default"
          data-testid="grouping-result"
        >
          <h2 class="text-lg font-bold text-highlighted">
            {{ won ? t('pz.play.done') : t('pz.play.wrong') }}
          </h2>
          <div class="mt-3 flex flex-col gap-2">
            <div
              v-for="group in puzzle.groups"
              :key="group.id"
              class="rounded-lg px-3 py-2 text-center text-sm font-semibold"
              :class="GROUP_BAND[group.colorIndex]"
            >
              {{ group.label }}
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2 print:hidden">
            <UButton
              v-if="won"
              :label="t('pz.play.groupShare')"
              color="neutral"
              variant="soft"
              @click="copyShare"
            />
            <UButton
              :label="t('pz.play.groupNewGame')"
              @click="newRandomGame"
            />
            <UButton
              :label="t('pz.play.groupDaily')"
              color="neutral"
              variant="outline"
              @click="playDaily"
            />
          </div>
        </section>
      </template>
    </div>
  </UContainer>
</template>
