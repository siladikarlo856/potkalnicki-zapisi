<script setup lang="ts">
import { pzRoutes } from '~~/shared/utils/appRoutes'
import { challengeCreateQueryForGame } from '~~/shared/utils/challengeCreateForm'
import { gameDefinition } from '~~/shared/utils/games/definitions'
import type { Difficulty, GameId } from '~~/shared/utils/games/types'
import { nounFor } from '~/utils/pzText'

// The start state of a game (`pocetak`): under the page title, three facts (questions, minutes, best score), how
// a round goes, the difficulty as a Pick, "Počni" and, where a game can be played against friends, the way to a
// challenge. Still the normal shell: the round bar only appears once the round has started.
const props = withDefaults(defineProps<{
  gameId: GameId
  /** Questions in a round. */
  questions?: number
  instructions?: readonly string[]
  /** False for a game that has no difficulty. */
  levels?: boolean
  disabled?: boolean
}>(), { questions: 10, levels: true })
const difficulty = defineModel<Difficulty>('difficulty', { default: 'srednje' })
const emit = defineEmits<{ start: [] }>()
const localePath = useLocalePath()
const { scores } = useGameScores()

const definition = computed(() => gameDefinition(props.gameId))
const challengeQuery = computed(() => challengeCreateQueryForGame(props.gameId))
const challengeHref = computed(() => localePath(challengeQuery.value
  ? { path: pzRoutes.challengeNew, query: challengeQuery.value }
  : pzRoutes.challenge))
const minutes = computed(() => definition.value.catalogue?.minutes)
const best = computed(() => {
  const entry = scores.value.best[props.gameId]
  return entry ? (props.gameId === 'bez-greske' ? String(entry.score) : `${entry.score}/${entry.max}`) : 'još nema'
})
const facts = computed(() => [
  { value: `Do ${props.questions}`, label: nounFor(props.questions, ['pitanje', 'pitanja']) },
  ...(minutes.value ? [{ value: String(minutes.value), label: nounFor(minutes.value, ['minuta', 'minute', 'minuta']) }] : []),
  { value: best.value, label: 'najbolji rezultat' }
])
const steps = computed(() => props.instructions ?? ['Odaberi odgovor pa pritisni „Provjeri”.', 'Nema ograničenja vremena.'])
const levelOptions = [
  { value: 'lako', label: 'Lako', description: 'Opcije se jasnije razlikuju.', testid: 'game-level-lako' },
  { value: 'srednje', label: 'Srednje', description: 'Uravnotežena pitanja.', testid: 'game-level-srednje' },
  { value: 'tesko', label: 'Teško', description: 'Slične opcije, manje očitih tragova.', testid: 'game-level-tesko' }
]
const level = computed({ get: () => difficulty.value, set: value => (difficulty.value = value as Difficulty) })
</script>

<template>
  <div
    class="flex flex-col gap-6"
    data-testid="game-start"
  >
    <dl
      class="m-0 grid grid-cols-3 gap-2 text-center"
      data-testid="game-start-facts"
    >
      <div
        v-for="fact in facts"
        :key="fact.label"
        class="flex flex-col rounded-(--pz-radius-md) bg-elevated px-2 py-3"
      >
        <dt class="order-2 text-xs text-muted">
          {{ fact.label }}
        </dt>
        <dd class="m-0 font-display text-2xl leading-tight font-bold text-highlighted tabular-nums">
          {{ fact.value }}
        </dd>
      </div>
    </dl>

    <ul class="m-0 flex list-none flex-col gap-1.5 p-0 text-default">
      <li
        v-for="step in steps"
        :key="step"
        class="flex items-start gap-2"
      >
        <UIcon
          name="i-lucide-check"
          class="mt-1 size-4 shrink-0 text-primary"
          aria-hidden="true"
        />
        {{ step }}
      </li>
    </ul>

    <Pick
      v-if="levels"
      v-model="level"
      legend="Težina"
      name="game-difficulty"
      :options="levelOptions"
    />

    <div class="flex flex-col gap-3">
      <UButton
        label="Počni"
        icon="i-lucide-play"
        size="xl"
        block
        :disabled="disabled"
        data-testid="game-start-button"
        @click="emit('start')"
      />
      <UButton
        v-if="definition.challengeable"
        :to="challengeHref"
        :label="challengeQuery ? 'Izazovi prijatelje ovom igrom' : 'Izazovi prijatelje'"
        icon="i-lucide-flag"
        color="neutral"
        variant="outline"
        size="lg"
        block
        data-testid="game-start-challenge"
      />
    </div>
  </div>
</template>
