<script setup lang="ts">
import type { ChallengeTemplateContent } from '~~/shared/utils/content/challengeTemplate'
import { CHALLENGE_LIMITS, challengeSummary } from '~~/shared/utils/content/challengeTemplate'

// The nested editor of a challenge set: sample flag, title, then rounds of multiple-choice
// questions. It edits the dialog's form state in place; field names follow the shared validator's
// issue paths (`content.rounds.0.questions.1.prompt.hr`), so every problem shows at its input.
const props = withDefaults(defineProps<{
  /** Path of the content in the form state. */
  name?: string
}>(), { name: 'content' })
const content = defineModel<ChallengeTemplateContent>({ required: true })
const confirm = useAdminConfirm()

const summary = computed(() => challengeSummary(content.value))
const full = computed(() => content.value.rounds.length >= CHALLENGE_LIMITS.rounds)

function moveRound(index: number, delta: -1 | 1) {
  moveItem(content.value.rounds, index, index + delta)
}

async function removeRound(index: number) {
  const round = content.value.rounds[index]
  if (!round) return
  const questions = round.questions.filter(question => !isBlankQuestion(question)).length
  if ((questions || !isBlankText(round.topic)) && !await confirm({
    title: `Ukloniti krug ${index + 1}?`,
    description: questions ? `Uklanja se i ${questions} ${questions === 1 ? 'pitanje' : 'pitanja'} iz ovog kruga.` : 'Krug se uklanja iz ovog izazova.',
    confirmLabel: 'Ukloni krug',
    color: 'error'
  })) return
  content.value.rounds.splice(index, 1)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <AdminChallengeTextPair
      v-model="content.title"
      :name="`${props.name}.title`"
      label="Naslov izazova"
    />

    <UFormField
      :name="`${props.name}.sample`"
      description="Igrači vide oznaku „Uzorak“ dok sva pitanja nisu provjerena."
    >
      <USwitch
        v-model="content.sample"
        label="Uzorak"
      />
    </UFormField>

    <UFormField
      :name="`${props.name}.rounds`"
      :label="`Krugovi (${summary.rounds})`"
      :description="`${summary.questions} ${summary.questions % 10 === 1 && summary.questions % 100 !== 11 ? 'pitanje' : 'pitanja'} · najviše ${summary.maxScore} bodova · do ${CHALLENGE_LIMITS.rounds} krugova po ${CHALLENGE_LIMITS.questionsPerRound} pitanja`"
    >
      <div class="mt-2 flex flex-col gap-4">
        <AdminChallengeRoundEditor
          v-for="(round, index) in content.rounds"
          :key="round.id"
          :content="content"
          :index="index"
          :name="`${props.name}.rounds.${index}`"
          @move="delta => moveRound(index, delta)"
          @remove="removeRound(index)"
        />
      </div>
    </UFormField>

    <UButton
      :label="full ? `Izazov je pun (${CHALLENGE_LIMITS.rounds} krugova)` : 'Dodaj krug'"
      icon="i-lucide-list-plus"
      color="neutral"
      variant="outline"
      :disabled="full"
      class="self-start"
      data-test="challenge-add-round"
      @click="addRound(content)"
    />
  </div>
</template>
