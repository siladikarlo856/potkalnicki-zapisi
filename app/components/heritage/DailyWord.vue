<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { dailyWordShareText, guessDailyWord, startDailyGame } from '~~/shared/utils/dailyWord'
import type { DailyGame, DailyText } from '~~/shared/utils/dailyWord'
import { describeClue, pluralForm } from '~/utils/dailyClues'

// `bare` drops the section's own width and padding, for a page that lays the card out itself (the home grid).
const props = withDefaults(defineProps<{ compactWhenPlayed?: boolean, bare?: boolean }>(), { compactWhenPlayed: false, bare: false })

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

const expanded = ref(false)
const showCompact = computed(() => props.compactWhenPlayed && !!finished.value && !replaced.value && !expanded.value)
const shareText = computed(() => payload.value && finished.value ? dailyWordShareText(payload.value.number, finished.value) : '')
const compactResult = computed(() => {
  if (!finished.value) return ''
  const { solved, tries, maxTries } = finished.value
  return solved ? `${tries}/${maxTries}` : `X/${maxTries}`
})
const compactCountdown = computed(() => {
  if (!payload.value) return ''
  const minutes = Math.max(0, Math.ceil((Date.parse(payload.value.nextAt) - Date.now()) / 60_000))
  const hours = Math.floor(minutes / 60)
  return hours
    ? t('daily.countdown.hoursMinutes', { h: hours, m: minutes % 60 })
    : t('daily.countdown.minutes', { m: minutes })
})
const shareLabels = computed(() => ({
  copy: t('daily.share.copy'),
  copied: t('daily.share.copied'),
  nativeShare: t('daily.share.nativeShare'),
  copyError: t('daily.share.copyError'),
  shareError: t('daily.share.shareError'),
  whatsapp: t('challenge.whatsapp'),
  viber: t('challenge.viber')
}))

watch(finished, () => {
  expanded.value = false
})
</script>

<template>
  <section
    v-if="!hidden"
    id="rijec-dana"
    :aria-labelledby="ready || error ? 'daily-title' : undefined"
    :aria-busy="ready || !!error ? undefined : 'true'"
    class="w-full"
    :class="bare ? undefined : 'mx-auto max-w-xl px-4 py-6 sm:py-8'"
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
      v-else-if="showCompact && payload && finished && stats"
      class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-default p-3 ring ring-default sm:p-4"
      data-testid="daily-compact-row"
    >
      <p class="min-w-0 text-sm text-muted">
        {{ t('daily.compactSummary', {
          n: payload.number,
          result: compactResult,
          streak: stats.streak,
          countdown: compactCountdown
        }) }}
      </p>
      <HeritageShareButtons
        v-if="shareText"
        class="max-w-full print:hidden"
        prefix="daily-compact"
        :copy-text="shareText"
        :share-data="{ title: t('daily.share.shareTitle'), text: shareText }"
        :message-text="shareText"
        :labels="shareLabels"
        emphasis="share"
      >
        <UButton
          :label="t('daily.compactShow')"
          color="neutral"
          variant="outline"
          @click="expanded = true"
        />
      </HeritageShareButtons>
      <UButton
        v-else
        class="print:hidden"
        :label="t('daily.compactShow')"
        color="neutral"
        variant="outline"
        @click="expanded = true"
      />
    </div>

    <div
      v-else-if="game"
      class="min-w-0 overflow-hidden rounded-(--pz-radius-lg) border border-accented bg-default"
    >
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="sr-only"
      >
        {{ announcement }}
      </p>
      <header class="flex flex-col items-center gap-1 bg-(--pz-wheat) p-4 text-center sm:p-5">
        <p class="pz-overline text-default">
          <span id="daily-title">{{ t('daily.number', { n: payload.number }) }}</span>
        </p>
        <template v-if="!replaced">
          <h2
            lang="hr"
            class="pz-headword wrap-anywhere text-highlighted"
          >
            {{ payload.entry.headword }}
          </h2>
          <p class="pz-body-sm flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-default">
            <span
              v-if="payload.entry.partOfSpeech"
              lang="hr"
              class="font-serif italic"
            >{{ payload.entry.partOfSpeech }}</span>
            <span v-if="payload.entry.partOfSpeech && place">·</span>
            <span v-if="place">{{ t('daily.village', { place }) }}</span>
            <UBadge
              v-if="payload.sample"
              :label="t('daily.sample')"
              color="neutral"
              variant="outline"
              size="sm"
            />
          </p>
        </template>
        <PzStitch class="mx-auto mt-2" />
      </header>

      <div class="p-4 sm:p-5">
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
                  class="shrink-0 text-xs text-muted"
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

        <HeritageDailyContribute
          v-if="game.done && !replaced"
          class="mt-4 border-t border-default pt-3"
          :word-id="payload.entry.id"
          :headword="payload.entry.headword"
        />

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
          :category="payload.entry.category"
        />
      </div>
    </div>
  </section>
</template>
