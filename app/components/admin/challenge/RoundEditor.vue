<script setup lang="ts">
import type { ChallengeTemplateContent } from '~~/shared/utils/content/challengeTemplate'
import { CHALLENGE_LIMITS } from '~~/shared/utils/content/challengeTemplate'

// One round: its topic and its questions, which can be added, copied, reordered and removed.
const props = defineProps<{
  /** The whole template content: new ids must be unique across every round. */
  content: ChallengeTemplateContent
  index: number
  /** Path of the round in the form state, e.g. `content.rounds.0`. */
  name: string
}>()
const emit = defineEmits<{ move: [delta: -1 | 1], remove: [] }>()
const confirm = useAdminConfirm()

// The content is the dialog's form state; rounds and questions are edited in place.
const round = computed(() => props.content.rounds[props.index]!)
const number = computed(() => props.index + 1)
const full = computed(() => round.value.questions.length >= CHALLENGE_LIMITS.questionsPerRound)

function moveQuestion(index: number, delta: -1 | 1) {
  moveItem(round.value.questions, index, index + delta)
}

async function removeQuestion(index: number) {
  const question = round.value.questions[index]
  if (!question) return
  if (!isBlankQuestion(question) && !await confirm({
    title: `Ukloniti pitanje ${index + 1}?`,
    description: question.prompt.hr.trim() || 'Pitanje i njegovi odgovori uklanjaju se iz ovog izazova.',
    confirmLabel: 'Ukloni pitanje',
    color: 'error'
  })) return
  round.value.questions.splice(index, 1)
}
</script>

<template>
  <section
    class="flex flex-col gap-4 rounded-lg border border-default bg-elevated/40 p-3 sm:p-4"
    :aria-label="`Krug ${number}`"
    :data-test="`challenge-round-${index}`"
  >
    <div class="flex items-center gap-2">
      <h3 class="min-w-0 flex-1 truncate font-semibold text-highlighted">
        Krug {{ number }}<span
          v-if="round.topic.hr.trim()"
          class="font-normal text-muted"
        >: {{ round.topic.hr }}</span>
      </h3>
      <UButton
        icon="i-lucide-arrow-up"
        color="neutral"
        variant="ghost"
        size="sm"
        :disabled="index === 0"
        :aria-label="`Pomakni krug ${number} gore`"
        @click="emit('move', -1)"
      />
      <UButton
        icon="i-lucide-arrow-down"
        color="neutral"
        variant="ghost"
        size="sm"
        :disabled="index === content.rounds.length - 1"
        :aria-label="`Pomakni krug ${number} dolje`"
        @click="emit('move', 1)"
      />
      <UButton
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        size="sm"
        :disabled="content.rounds.length <= 1"
        :aria-label="`Ukloni krug ${number}`"
        data-test="challenge-round-remove"
        @click="emit('remove')"
      />
    </div>

    <AdminChallengeTextPair
      v-model="round.topic"
      :name="`${name}.topic`"
      label="Tema kruga"
    />

    <UFormField
      :name="`${name}.questions`"
      :label="`Pitanja (${round.questions.length})`"
    >
      <div class="mt-1 flex flex-col gap-2">
        <AdminChallengeQuestionEditor
          v-for="(question, questionIndex) in round.questions"
          :key="question.id"
          v-model="round.questions[questionIndex]!"
          :name="`${name}.questions.${questionIndex}`"
          :index="questionIndex"
          :count="round.questions.length"
          :can-duplicate="!full"
          @move="delta => moveQuestion(questionIndex, delta)"
          @duplicate="duplicateQuestion(content, index, questionIndex)"
          @remove="removeQuestion(questionIndex)"
        />
      </div>
    </UFormField>

    <UButton
      :label="full ? `Krug je pun (${CHALLENGE_LIMITS.questionsPerRound} pitanja)` : 'Dodaj pitanje'"
      icon="i-lucide-plus"
      color="neutral"
      variant="outline"
      :disabled="full"
      class="self-start"
      data-test="challenge-add-question"
      @click="addQuestion(content, index)"
    />
  </section>
</template>
