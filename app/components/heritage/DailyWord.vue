<script setup lang="ts">
import { guessDailyWord, startDailyGame } from '~~/shared/utils/dailyWord'
import type { DailyGame, DailyText } from '~~/shared/utils/dailyWord'
import { describeClue, pluralForm } from '~/utils/dailyClues'

const { locale, t } = useI18n()
const { payload, status, error, unavailable, refresh } = useDailyWord()
const progress = useDailyProgress()

const english = computed(() => locale.value === 'en')
const stored = computed(() => payload.value ? progress.days.value[payload.value.day] : undefined)
/** The visitor already played a different word today: it was withdrawn and replaced afterwards. */
const replaced = computed(() => !!payload.value && !!stored.value && stored.value.wordId !== payload.value.entry.id)
/** The finished result for today's day, whether it was played here or before the word was replaced. */
const finished = computed(() => stored.value?.done ? stored.value : undefined)
const todayKey = computed<'1' | '2' | '3' | 'X'>(() => finished.value?.solved ? String(finished.value.tries) as '1' | '2' | '3' : 'X')
const stats = computed(() => payload.value ? progress.statsFor(payload.value.day) : undefined)
const maxTries = computed(() => (payload.value?.options.length ?? 1) - 1)
const game = ref<DailyGame>()
const place = computed(() => payload.value?.areas.find(area => area.id === payload.value?.villageAreaId)?.name)
const shownClues = computed(() => payload.value && game.value ? payload.value.clues.slice(0, game.value.cluesShown) : [])
const visibleOptions = computed(() => payload.value && game.value ? payload.value.options.filter(option => game.value!.optionsLeft.includes(option.id)) : [])
const announcement = ref('')
const clueList = useTemplateRef<{ focusLatest: () => void }>('clueList')
const reveal = useTemplateRef<{ focus: () => void }>('reveal')

// Resume from this device's saved guesses, so a reload cannot be used to retry.
function rebuild() {
  if (!payload.value || !progress.loaded.value) return
  let next = startDailyGame(payload.value)
  if (stored.value && !replaced.value) for (const id of stored.value.guesses) next = guessDailyWord(next, payload.value, id)
  game.value = next
}
watch(() => [payload.value?.day, payload.value?.entry.id, progress.loaded.value] as const, rebuild, { immediate: true })
// Finishing the round in another tab updates this one.
watch(stored, (record) => {
  if (record && !replaced.value && game.value && record.guesses.length > game.value.guesses.length) rebuild()
})

function optionText(text: DailyText) {
  const en = english.value ? text.en?.trim() : undefined
  return { text: en || text.hr, lang: en ? 'en' : 'hr' }
}

async function pick(optionId: string) {
  const current = payload.value
  const previous = game.value
  if (!current || !previous) return
  const updated = guessDailyWord(previous, current, optionId)
  if (updated === previous) return
  game.value = updated
  progress.save(current.day, {
    wordId: current.entry.id,
    guesses: updated.guesses,
    done: updated.done,
    solved: updated.solved,
    tries: updated.guesses.length,
    maxTries: maxTries.value,
    ...(updated.done ? { finishedAt: new Date().toISOString() } : {})
  })
  if (updated.done) {
    announcement.value = updated.solved ? t(`daily.solved.${pluralForm(locale.value, updated.guesses.length)}`, { n: updated.guesses.length }) : t('daily.missed')
  } else {
    const clue = current.clues[updated.cluesShown - 1]
    const left = maxTries.value - updated.guesses.length
    const described = clue && describeClue((key, named) => t(key, named ?? {}), clue, current.areas)
    announcement.value = [t('daily.wrong'), described && `${described.label}${described.text ? ` — ${described.text}` : ''}`, t(`daily.triesLeft.${pluralForm(locale.value, left)}`, { n: left })].filter(Boolean).join(' ')
  }
  await nextTick()
  if (updated.done) reveal.value?.focus()
  else clueList.value?.focusLatest()
}

const loading = computed(() => !error.value && (status.value === 'idle' || status.value === 'pending') && !payload.value)
const ready = computed(() => !!payload.value && progress.loaded.value && !!game.value)
// Before launch the API answers 404 and nothing at all is shown.
const hidden = computed(() => unavailable.value)
</script>

<template>
  <section
    v-if="!hidden"
    id="rijec-dana"
    :aria-labelledby="ready || error ? 'daily-title' : undefined"
    :aria-busy="ready || !!error ? undefined : 'true'"
    class="mx-auto w-full max-w-xl px-4 py-6 sm:py-8"
    data-testid="daily-word"
  >
    <div
      v-if="loading || (!error && !ready)"
      class="min-h-96 animate-pulse rounded-xl bg-elevated motion-reduce:animate-none"
      aria-hidden="true"
      data-testid="daily-skeleton"
    />

    <div
      v-else-if="error || !payload"
      class="rounded-xl bg-default p-4 ring ring-default"
      role="status"
    >
      <h2
        id="daily-title"
        class="text-lg font-bold text-highlighted"
      >
        {{ t('daily.title') }}
      </h2>
      <p>{{ t('daily.error') }}</p>
      <UButton
        :label="t('daily.retry')"
        variant="link"
        @click="refresh()"
      />
    </div>

    <div
      v-else-if="game"
      class="min-w-0 rounded-xl bg-default p-4 shadow-sm ring ring-default sm:p-5"
    >
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="sr-only"
      >
        {{ announcement }}
      </p>
      <header class="mb-3 text-center">
        <p class="text-xs font-semibold text-primary">
          <span id="daily-title">{{ t('daily.title') }}</span> · {{ t('daily.number', { n: payload.number }) }}
        </p>
        <template v-if="!replaced">
          <h2
            lang="hr"
            class="mt-1 text-3xl font-bold wrap-anywhere text-highlighted sm:text-4xl"
          >
            {{ payload.entry.headword }}
          </h2>
          <p class="mt-1 flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
            <span
              v-if="payload.entry.partOfSpeech"
              lang="hr"
            >{{ payload.entry.partOfSpeech }}</span>
            <UBadge
              v-if="payload.sample"
              :label="t('daily.sample')"
              color="neutral"
              variant="outline"
              size="sm"
            />
          </p>
          <p
            v-if="place"
            class="mt-1 text-sm text-muted"
          >
            {{ t('daily.village', { place }) }}
          </p>
        </template>
      </header>

      <p
        v-if="progress.storageUnavailable.value"
        class="mb-3 text-xs text-muted"
        data-testid="daily-storage-note"
      >
        {{ t('daily.storageUnavailable') }}
      </p>

      <div
        v-if="replaced && stored"
        class="flex flex-col gap-2"
        data-testid="daily-replaced"
      >
        <p>{{ t('daily.replaced') }}</p>
        <p class="text-sm text-muted">
          {{ t('daily.usedTries', { tries: stored.solved ? stored.tries : 'X', max: stored.maxTries }) }}
        </p>
      </div>

      <template v-else>
        <fieldset
          v-if="!game.done"
          class="min-w-0"
        >
          <legend class="mb-2 text-xs font-medium text-muted">
            {{ t('daily.prompt') }}
          </legend>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <UButton
              v-for="(option, index) in visibleOptions"
              :key="option.id"
              :data-option-id="option.id"
              :lang="optionText(option.text).lang"
              color="neutral"
              variant="outline"
              size="lg"
              class="min-h-11 min-w-0 justify-start text-start whitespace-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              @click="pick(option.id)"
            >
              <span
                class="shrink-0 text-xs opacity-60"
                aria-hidden="true"
              >{{ index + 1 }}.</span>
              <span class="min-w-0 wrap-anywhere">{{ optionText(option.text).text }}</span>
            </UButton>
          </div>
          <p class="mt-2 text-xs text-muted">
            {{ t(`daily.triesLeft.${pluralForm(locale, maxTries - game.guesses.length)}`, { n: maxTries - game.guesses.length }) }}
          </p>
        </fieldset>

        <HeritageDailyClues
          v-if="shownClues.length"
          ref="clueList"
          class="mt-3"
          :clues="shownClues"
          :areas="payload.areas"
        />

        <HeritageDailyReveal
          v-if="game.done"
          ref="reveal"
          class="mt-3"
          :payload="payload"
          :solved="game.solved"
          :tries="game.guesses.length"
          :max-tries="maxTries"
        />
      </template>

      <template v-if="finished && stats">
        <HeritageDailyShare
          class="mt-4 border-t border-default pt-3"
          :number="payload.number"
          :result="finished"
        />
        <HeritageDailyStats
          class="mt-4 border-t border-default pt-3"
          :stats="stats"
          :today="todayKey"
        />
      </template>

      <HeritageDailyCountdown
        v-if="game.done || replaced"
        class="mt-4 border-t border-default pt-3"
        :next-at="payload.nextAt"
      />
      <p
        v-if="game.done || replaced"
        class="mt-1 text-xs text-muted"
      >
        {{ t('daily.savedOnDevice') }}
      </p>

      <HeritageDailyNextSteps
        v-if="game.done || replaced"
        class="mt-4 border-t border-default pt-3"
      />
    </div>
  </section>
</template>
