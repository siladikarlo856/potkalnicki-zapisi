<script setup lang="ts">
import { gameDefinition } from '~~/shared/utils/games/definitions'
import { formatTimerSeconds, matchSettlement, nabrojiTimerSeconds } from '~~/shared/utils/games/matchSettlement'
import type { PoolMunicipality } from '~~/shared/utils/learn/types'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const game = gameDefinition('nabroji')

const { t } = useI18n()
const { recordBest } = useGameScores()
const { pool, status, error, refresh } = useCardPool()
const loading = computed(() => !error.value && (status.value === 'idle' || status.value === 'pending'))

type Phase = 'pick' | 'play' | 'reveal' | 'result'

const phase = ref<Phase>('pick')
const unit = ref<PoolMunicipality | null>(null)
const found = ref<string[]>([])
const input = ref('')
const message = ref<'idle' | 'duplicate' | 'unknown'>('idle')
const remaining = ref(0)
let timerId: ReturnType<typeof setInterval> | undefined

const units = computed(() =>
  pool.value.municipalities
    .map((municipality) => {
      const names = pool.value.settlements
        .filter(s => s.municipalityId === municipality.id)
        .map(s => s.name)
      return { municipality, names }
    })
    .filter(row => row.names.length > 0)
    .sort((a, b) => a.municipality.label.localeCompare(b.municipality.label, 'hr'))
)

const settlementNames = computed(() => {
  if (!unit.value) return [] as string[]
  return pool.value.settlements
    .filter(s => s.municipalityId === unit.value!.id)
    .map(s => s.name)
    .sort((a, b) => a.localeCompare(b, 'hr'))
})

const slots = computed(() =>
  settlementNames.value.map(name => ({
    name,
    hit: found.value.includes(name)
  }))
)

const timerLabel = computed(() => formatTimerSeconds(remaining.value))

const resultPct = computed(() => {
  const total = settlementNames.value.length
  if (!total) return 0
  return Math.round((found.value.length / total) * 100)
})

function stopTimer() {
  if (timerId !== undefined) {
    clearInterval(timerId)
    timerId = undefined
  }
}

function startUnit(selected: PoolMunicipality) {
  unit.value = selected
  found.value = []
  input.value = ''
  message.value = 'idle'
  phase.value = 'play'
  remaining.value = nabrojiTimerSeconds(settlementNames.value.length)
  stopTimer()
  timerId = setInterval(() => {
    if (remaining.value <= 1) {
      remaining.value = 0
      finishRound()
      return
    }
    remaining.value -= 1
  }, 1000)
}

function finishRound() {
  stopTimer()
  phase.value = 'result'
  if (unit.value && settlementNames.value.length) {
    recordBest(game.id, found.value.length, settlementNames.value.length)
  }
}

function reveal() {
  stopTimer()
  phase.value = 'reveal'
  recordBest(game.id, found.value.length, settlementNames.value.length)
}

function submit() {
  message.value = 'idle'
  const names = settlementNames.value
  if (!names.length) return
  const match = matchSettlement(input.value, names)
  if (!match) {
    message.value = 'unknown'
    return
  }
  if (found.value.includes(match)) {
    message.value = 'duplicate'
    input.value = ''
    return
  }
  found.value = [...found.value, match].sort((a, b) => a.localeCompare(b, 'hr'))
  input.value = ''
  if (found.value.length >= names.length) {
    finishRound()
  }
}

function pickAgain() {
  stopTimer()
  unit.value = null
  found.value = []
  input.value = ''
  message.value = 'idle'
  phase.value = 'pick'
}

onBeforeUnmount(stopTimer)

useSeoMeta({
  title: () => t('pz.play.nabrojiTitle'),
  ogTitle: () => `${t('pz.play.nabrojiTitle')} · Potkalnički zapisi`,
  ogDescription: () => t('pz.play.nabrojiDescription'),
  description: () => t('pz.play.nabrojiDescription')
})
</script>

<template>
  <UContainer class="py-3 sm:py-5 lg:py-6">
    <div
      class="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-3"
      data-testid="game-nabroji"
    >
      <header>
        <p class="mb-1 text-xs font-semibold text-primary">
          {{ t('pz.play.nabrojiEyebrow') }}
        </p>
        <h1 class="text-2xl font-bold tracking-tight text-highlighted sm:text-3xl">
          {{ t('pz.play.nabrojiTitle') }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ t('pz.play.nabrojiDescription') }}
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
        v-else-if="!units.length"
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

      <section
        v-else-if="phase === 'pick'"
        class="flex flex-col gap-2 rounded-xl bg-default p-4 ring ring-default"
      >
        <p class="text-sm font-semibold text-highlighted">
          {{ t('pz.play.nabrojiPickUnit') }}
        </p>
        <UButton
          v-for="row in units"
          :key="row.municipality.id"
          :label="row.municipality.label"
          color="neutral"
          variant="soft"
          block
          class="justify-start"
          :data-testid="`nabroji-unit-${row.municipality.slug}`"
          @click="startUnit(row.municipality)"
        />
      </section>

      <template v-else-if="unit && (phase === 'play' || phase === 'reveal' || phase === 'result')">
        <p class="text-sm font-semibold text-highlighted">
          {{ unit.label }}
        </p>
        <p
          v-if="phase === 'play'"
          class="text-sm text-muted"
          data-testid="nabroji-timer"
        >
          {{ t('pz.play.nabrojiTimeLeft', { time: timerLabel }) }}
        </p>

        <ul
          class="grid gap-1 sm:grid-cols-2"
          data-testid="nabroji-slots"
        >
          <li
            v-for="slot in slots"
            :key="slot.name"
            class="min-h-10 rounded-md px-2 py-1 text-sm ring ring-default"
            :class="slot.hit || phase !== 'play' ? 'bg-elevated text-highlighted' : 'text-muted'"
            :data-testid="`nabroji-slot-${slot.name}`"
          >
            {{ slot.hit || phase !== 'play' ? slot.name : '—' }}
          </li>
        </ul>

        <form
          v-if="phase === 'play'"
          class="flex flex-col gap-2"
          @submit.prevent="submit"
        >
          <input
            v-model="input"
            type="text"
            class="w-full rounded-md px-2.5 py-1.5 text-sm text-highlighted bg-default ring ring-inset ring-accented outline-primary/25 focus-visible:outline-2 focus-visible:outline-primary"
            :placeholder="t('pz.play.nabrojiInput')"
            autocomplete="off"
            autocapitalize="off"
            data-testid="nabroji-input"
          >
          <p
            v-if="message === 'duplicate'"
            role="status"
            class="text-sm text-warning"
          >
            {{ t('pz.play.nabrojiDuplicate') }}
          </p>
          <p
            v-else-if="message === 'unknown'"
            role="status"
            class="text-sm text-error"
          >
            {{ t('pz.play.nabrojiUnknown') }}
          </p>
          <div class="flex flex-col gap-2 sm:flex-row">
            <UButton
              :label="t('pz.play.nabrojiSubmit')"
              size="lg"
              block
              data-testid="nabroji-submit"
              @click="submit"
            />
            <UButton
              :label="t('pz.play.nabrojiGiveUp')"
              color="neutral"
              variant="soft"
              size="lg"
              block
              data-testid="nabroji-give-up"
              @click="reveal"
            />
          </div>
        </form>

        <div
          v-if="phase === 'reveal' || phase === 'result'"
          class="flex flex-col items-center gap-3 rounded-xl bg-default p-4 text-center ring ring-default"
          data-testid="game-result"
        >
          <p
            role="status"
            class="text-lg font-semibold text-highlighted"
            data-testid="game-result-score"
          >
            {{ t('pz.play.nabrojiResult', { found: found.length, count: settlementNames.length, pct: resultPct }) }}
          </p>
          <UButton
            :label="t('pz.play.again')"
            icon="i-lucide-rotate-ccw"
            size="xl"
            block
            data-testid="nabroji-restart"
            @click="pickAgain"
          />
        </div>
      </template>
    </div>
  </UContainer>
</template>
