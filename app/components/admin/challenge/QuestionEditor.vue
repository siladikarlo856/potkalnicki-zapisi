<script setup lang="ts">
import type { ChallengeQuestion } from '~~/shared/utils/challenge'
import { CHALLENGE_LIMITS } from '~~/shared/utils/content/challengeTemplate'

// One multiple-choice question: prompt, two to four choices, the correct one and the explanation
// players see after answering. Collapsible, so a long round stays easy to scan; the inputs stay
// mounted while collapsed, so validation still reaches them.
const props = defineProps<{
  /** Path of the question in the form state, e.g. `content.rounds.0.questions.2`. */
  name: string
  index: number
  count: number
  /** Whether the round has room for a copy. */
  canDuplicate: boolean
}>()
const question = defineModel<ChallengeQuestion>({ required: true })
const emit = defineEmits<{ move: [delta: -1 | 1], duplicate: [], remove: [] }>()

const blank = (text: { hr: string, en: string }) => !text.hr.trim() || !text.en.trim()
const incomplete = computed(() => blank(question.value.prompt) || blank(question.value.explanation) || question.value.options.some(blank))
const open = ref(incomplete.value)

const number = computed(() => props.index + 1)
const correctItems = computed(() => question.value.options.map((option, index) => ({
  label: option.hr.trim() || `Odgovor ${index + 1}`,
  value: index
})))
</script>

<template>
  <UCollapsible
    v-model:open="open"
    :unmount-on-hide="false"
    class="rounded-md border border-default"
    :data-test="`challenge-question-${index}`"
  >
    <template #default>
      <div class="flex items-center gap-2 p-2">
        <UButton
          :icon="open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          color="neutral"
          variant="ghost"
          class="min-w-0 flex-1 justify-start text-left"
          :aria-label="`Pitanje ${number}: ${open ? 'sažmi' : 'proširi'}`"
        >
          <span class="font-medium">Pitanje {{ number }}</span>
          <span class="truncate text-muted">{{ question.prompt.hr || 'bez teksta' }}</span>
        </UButton>
        <UBadge
          v-if="incomplete"
          label="Nepotpuno"
          color="warning"
          variant="subtle"
          size="sm"
        />
        <div
          class="flex shrink-0 items-center"
          @click.stop
        >
          <UButton
            icon="i-lucide-arrow-up"
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="index === 0"
            :aria-label="`Pomakni pitanje ${number} gore`"
            @click="emit('move', -1)"
          />
          <UButton
            icon="i-lucide-arrow-down"
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="index === count - 1"
            :aria-label="`Pomakni pitanje ${number} dolje`"
            @click="emit('move', 1)"
          />
          <UButton
            icon="i-lucide-copy-plus"
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="!canDuplicate"
            :aria-label="`Kopiraj pitanje ${number}`"
            @click="emit('duplicate')"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="sm"
            :disabled="count <= 1"
            :aria-label="`Ukloni pitanje ${number}`"
            data-test="challenge-question-remove"
            @click="emit('remove')"
          />
        </div>
      </div>
    </template>

    <template #content>
      <div class="flex flex-col gap-4 border-t border-default p-3">
        <AdminChallengeTextPair
          v-model="question.prompt"
          :name="`${name}.prompt`"
          label="Pitanje"
          multiline
        />

        <UFormField
          :name="`${name}.options`"
          label="Ponuđeni odgovori"
          :description="`Od ${CHALLENGE_LIMITS.minOptions} do ${CHALLENGE_LIMITS.maxOptions} različita odgovora.`"
        >
          <ol class="mt-1 flex flex-col gap-3">
            <li
              v-for="(option, optionIndex) in question.options"
              :key="optionIndex"
              class="flex items-start gap-2"
            >
              <UBadge
                :label="String(optionIndex + 1)"
                :color="optionIndex === question.correct ? 'success' : 'neutral'"
                :variant="optionIndex === question.correct ? 'solid' : 'subtle'"
                class="mt-7 w-6 shrink-0 justify-center"
                :aria-label="optionIndex === question.correct ? 'Točan odgovor' : undefined"
              />
              <AdminChallengeTextPair
                v-model="question.options[optionIndex]!"
                :name="`${name}.options.${optionIndex}`"
                :label="`Odgovor ${optionIndex + 1}`"
                class="min-w-0 flex-1"
              />
              <div class="mt-6 flex shrink-0 flex-col sm:flex-row">
                <UButton
                  icon="i-lucide-arrow-up"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :disabled="optionIndex === 0"
                  :aria-label="`Pomakni odgovor ${optionIndex + 1} gore`"
                  @click="moveOption(question, optionIndex, optionIndex - 1)"
                />
                <UButton
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :disabled="question.options.length <= CHALLENGE_LIMITS.minOptions"
                  :aria-label="`Ukloni odgovor ${optionIndex + 1}`"
                  @click="removeOption(question, optionIndex)"
                />
              </div>
            </li>
          </ol>
          <UButton
            v-if="question.options.length < CHALLENGE_LIMITS.maxOptions"
            label="Dodaj odgovor"
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            size="sm"
            class="mt-3"
            @click="addOption(question)"
          />
        </UFormField>

        <UFormField
          :name="`${name}.correct`"
          label="Točan odgovor"
          required
        >
          <URadioGroup
            v-model="question.correct"
            :items="correctItems"
            variant="card"
            :ui="{ fieldset: 'grid gap-2 sm:grid-cols-2' }"
            class="mt-1"
          />
        </UFormField>

        <AdminChallengeTextPair
          v-model="question.explanation"
          :name="`${name}.explanation`"
          label="Objašnjenje"
          placeholder="Prikazuje se nakon odgovora."
          multiline
        />
      </div>
    </template>
  </UCollapsible>
</template>
