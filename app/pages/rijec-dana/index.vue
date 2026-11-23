<script setup lang="ts">
import { pzRoutes } from '~~/shared/utils/appRoutes'
import {
  DAILY_TYPED_TRIES,
  dailyRevealedLetters,
  dailyWordShareMessage,
  foldDailyGuess,
  judgeDailyGuess
} from '~~/shared/utils/dailyWord'
import { encodeCardKey } from '~~/shared/utils/games/cardKey'
import { reviewCardKeys } from '~~/shared/utils/learn/session'
import { dailyDateLabel, triesOrdinal } from '~/utils/dailyClues'

// Riječ dana: one dialect word a day, guessed from up to three clues in at most five tries. It runs in the normal
// page shell, not the focus shell: it is one short puzzle, and people arrive from a shared link and should see where
// they are. The action bar pins "Provjeri"; the word is not in the markup until the round is over.
definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
const toast = useToast()
const baseUrl = useRuntimeConfig().public.i18n.baseUrl

useSeoMeta({
  title: 'Riječ dana',
  ogTitle: 'Riječ dana · Potkalnički zapisi',
  description: 'Jedna riječ domaćega govora na dan, pogodi je iz tragova.',
  ogDescription: 'Jedna riječ domaćega govora na dan, pogodi je iz tragova.'
})

const { payload, clues, refresh, error, replaced, stored, finished, solvedStreak, brokenStreak, loading, ready, progress } = useDailyToday()
const countdown = useDailyCountdown(() => payload.value?.nextAt)
const { cards, recordSeenCard, dueCount } = useProgress()
const { pool } = useCardPool()
const learn = useLearnState()

const guess = ref('')
const announcement = ref('')
const nearNote = ref('')
const justPlayed = ref(false)
const sharing = ref(false)
const guessComponent = useTemplateRef<{ focus: () => void }>('guessComponent')
const result = useTemplateRef<HTMLElement>('result')

watch([() => payload.value?.day, () => payload.value?.entry.id], () => {
  guess.value = ''
  announcement.value = ''
  nearNote.value = ''
  justPlayed.value = false
  sharing.value = false
})

const done = computed(() => !!stored.value?.done)
const playing = computed(() => ready.value && !error.value && !done.value)
const guesses = computed(() => !replaced.value && stored.value?.maxTries === DAILY_TYPED_TRIES ? stored.value.guesses : [])
const wrongGuesses = computed(() => finished.value?.solved ? guesses.value.slice(0, -1) : guesses.value)
const hintTotal = computed(() => clues.value.length)
const hints = computed(() => clues.value.slice(0, wrongGuesses.value.length + 1).map(text => ({ text })))
const letters = computed(() => payload.value ? dailyRevealedLetters(payload.value.entry.headword, wrongGuesses.value.length) : [])
const answers = computed(() => payload.value ? [payload.value.entry.headword, ...payload.value.entry.variants.map(variant => variant.form)] : [])
const dateLabel = computed(() => payload.value ? dailyDateLabel(payload.value.day) : '')
const overline = computed(() => `Riječ dana · ${dateLabel.value}`)

const solved = computed(() => !!finished.value?.solved)
const resultTitle = computed(() => {
  if (!finished.value) return ''
  if (!finished.value.solved) return replaced.value ? 'Danas nije išlo' : 'Danas nije išlo. Riječ je bila:'
  return justPlayed.value ? `Točno, u ${triesOrdinal(finished.value.tries)} pokušaju` : 'Današnja je riječ riješena'
})
const example = computed(() => payload.value?.entry.examples?.[0])

const shareUrl = computed(() => `${baseUrl}${localePath(pzRoutes.daily)}`)
const shareText = computed(() => payload.value && finished.value ? dailyWordShareMessage(payload.value.day, finished.value, solvedStreak.value) : '')

const wordKey = computed(() => payload.value && !payload.value.sample ? encodeCardKey({ kind: 'word', id: payload.value.entry.id }) : undefined)
const inLearning = computed(() => !!wordKey.value && Object.hasOwn(cards.value, wordKey.value))
const reviewKeys = computed(() => reviewCardKeys(pool.value, learn.place.value))
const due = computed(() => ready.value ? dueCount(reviewKeys.value) : 0)

useHidePzTabBar(playing, 'game')

async function submit() {
  const current = payload.value
  const text = guess.value.trim()
  if (!current || !text || done.value) return
  const verdict = judgeDailyGuess(text, answers.value)
  const next = [...guesses.value, text]
  const right = verdict.kind === 'right'
  const over = right || next.length >= DAILY_TYPED_TRIES
  progress.save(current.day, {
    wordId: current.entry.id,
    guesses: next,
    done: over,
    solved: right,
    tries: next.length,
    maxTries: DAILY_TYPED_TRIES,
    ...(over ? { finishedAt: new Date().toISOString() } : {})
  })
  guess.value = ''
  if (verdict.kind === 'right' && text.toLocaleLowerCase('hr') !== verdict.answer.toLocaleLowerCase('hr')) {
    const diacritics = foldDailyGuess(text) === foldDailyGuess(verdict.answer)
    nearNote.value = `Piše se: ${verdict.answer}. ${diacritics ? 'Razlika je samo u kvačici, pa se odgovor priznaje.' : 'Razlika je samo jedno slovo, pa se odgovor priznaje.'}`
  }
  if (over) {
    justPlayed.value = true
    await nextTick()
    const title = result.value?.querySelector('h1')
    title?.setAttribute('tabindex', '-1')
    title?.focus()
    return
  }
  const wrong = next.length
  const letter = [...current.entry.headword].filter(char => char !== ' ' && char !== '-')[wrong]
  const newClue = wrong < hintTotal.value
  const ordinal = ['', 'drugi', 'treći'][wrong] ?? ''
  announcement.value = newClue && letter
    ? `Netočno. Otkriven je ${ordinal} trag i ${wrong === 1 ? 'drugo' : wrong === 2 ? 'treće' : `${wrong + 1}.`} slovo: ${letter}.`
    : letter ? `Netočno. Otkriveno je još jedno slovo: ${letter}.` : 'Netočno.'
  await nextTick()
  guessComponent.value?.focus()
}

function addToLearning() {
  if (wordKey.value && !inLearning.value) recordSeenCard(wordKey.value)
}

function copied() {
  toast.add({ title: 'Kopirano', color: 'success' })
  sharing.value = false
}
</script>

<template>
  <UContainer class="py-4 lg:py-6">
    <div class="mx-auto flex w-full max-w-(--pz-game-col) flex-col">
      <div
        v-if="loading || (!error && !ready)"
        aria-busy="true"
        data-testid="daily-page-loading"
      >
        <PageHead
          overline="Riječ dana"
          title="Koja je ovo riječ?"
        />
        <p
          class="sr-only"
          role="status"
        >
          Učitavanje riječi dana…
        </p>
        <div
          class="space-y-4"
          aria-hidden="true"
        >
          <USkeleton class="h-16 w-full rounded-(--pz-radius-md)" />
          <USkeleton class="h-[42px] w-60" />
          <USkeleton class="h-13 w-full rounded-(--pz-radius-md)" />
        </div>
      </div>

      <PageState
        v-else-if="error || !payload"
        kind="error"
        title="Riječ dana nismo uspjeli učitati"
        description="Nije do tebe. Niz ti se ne prekida zbog naše greške: ako danas ne uspije, sutra nastavljaš gdje je stalo."
        @retry="refresh()"
      />

      <form
        v-else-if="playing"
        novalidate
        data-testid="daily-play"
        @submit.prevent="submit"
      >
        <PageHead
          :overline="overline"
          title="Koja je ovo riječ?"
        />
        <UBadge
          v-if="payload.sample"
          :label="t('daily.sample')"
          color="neutral"
          variant="outline"
          class="mb-3 self-start"
          data-testid="daily-sample"
        />
        <DailyWordGuess
          ref="guessComponent"
          v-model="guess"
          :attempt="wrongGuesses.length + 1"
          :max-tries="DAILY_TYPED_TRIES"
          :hints="hints"
          :hint-total="hintTotal"
          :letters="letters"
          :guesses="wrongGuesses"
          :announcement="announcement"
        />
        <ActionBar class="-mx-4 mt-6">
          <UButton
            type="submit"
            label="Provjeri"
            size="xl"
            :disabled="!guess.trim()"
            data-testid="daily-check"
          />
        </ActionBar>
      </form>

      <div
        v-else
        ref="result"
        class="flex flex-col"
        data-testid="daily-result"
      >
        <PageHead
          :overline="overline"
          :title="resultTitle"
        />
        <UBadge
          v-if="payload.sample"
          :label="t('daily.sample')"
          color="neutral"
          variant="outline"
          class="mb-3 self-start"
          data-testid="daily-sample"
        />

        <section
          class="flex flex-col gap-2 rounded-(--pz-radius-lg) border border-transparent bg-(--pz-accent) p-4 text-(--pz-on-accent) sm:p-5"
          aria-label="Današnja riječ"
          data-testid="daily-answer-card"
        >
          <template v-if="replaced">
            <p>Današnja je riječ u međuvremenu zamijenjena, a tvoj je rezultat za ovaj dan sačuvan.</p>
          </template>
          <template v-else>
            <p
              class="pz-headword wrap-anywhere"
              lang="hr"
            >
              {{ payload.entry.headword }}
            </p>
            <p class="pz-h2 font-normal">
              znači <b>{{ payload.entry.meaning.hr }}</b>
            </p>
            <template v-if="example">
              <p
                class="mt-2"
                lang="hr"
              >
                <i>„{{ example.text }}”</i>
              </p>
              <p
                v-if="example.translation"
                class="text-sm"
              >
                „{{ example.translation }}”
              </p>
            </template>
            <p
              v-if="nearNote"
              class="text-sm font-semibold"
              data-testid="daily-near-note"
            >
              {{ nearNote }}
            </p>
          </template>
          <p class="mt-2">
            <StreakCounter
              v-if="solved && solvedStreak > 0"
              :days="solvedStreak"
              on-accent
            />
            <span
              v-else-if="!solved && brokenStreak > 0"
              class="text-sm"
              data-testid="daily-streak-broken"
            >Niz od {{ brokenStreak }} dana je prekinut. Sutra počinje novi.</span>
            <span
              v-else-if="!solved"
              class="text-sm"
            >Sutra počinje novi niz.</span>
          </p>
        </section>

        <div class="mt-4 flex flex-col gap-3">
          <UButton
            label="Podijeli"
            icon="i-lucide-share-2"
            size="xl"
            block
            data-testid="daily-share-open"
            @click="sharing = true"
          />
          <div class="grid gap-3 sm:grid-cols-2">
            <UButton
              v-if="!replaced && wordKey"
              :label="inLearning ? 'Dodano u učenje' : 'Dodaj u učenje'"
              :icon="inLearning ? 'i-lucide-check' : 'i-lucide-graduation-cap'"
              color="neutral"
              variant="outline"
              block
              :disabled="inLearning"
              data-testid="daily-add-learning"
              @click="addToLearning"
            />
          </div>
        </div>

        <p
          class="mt-5 text-center text-muted"
          data-testid="daily-countdown"
        >
          Nova riječ za <b class="tabular-nums">{{ countdown }}</b>.
        </p>

        <HeritageDailyContribute
          v-if="!replaced"
          class="mt-6 border-t border-default pt-4"
          :word-id="payload.entry.id"
          :headword="payload.entry.headword"
        />

        <section
          class="mt-6"
          aria-labelledby="daily-tomorrow"
        >
          <h2
            id="daily-tomorrow"
            class="pz-h3 mb-2 text-highlighted"
          >
            Do sutra
          </h2>
          <ul class="m-0 flex list-none flex-col gap-2 p-0">
            <li>
              <NuxtLink
                :to="localePath(pzRoutes.learn)"
                class="flex min-h-14 items-center gap-3 rounded-(--pz-radius-md) border border-default px-3 py-2 hover:border-accented"
              >
                <UIcon
                  name="i-lucide-graduation-cap"
                  class="size-5 shrink-0"
                  aria-hidden="true"
                />
                <span class="min-w-0 flex-1"><b class="block">Uči riječi</b><small class="text-muted">{{ due > 0 ? `${due} riječi čeka ponavljanje` : 'Kartice s riječima domaćega govora' }}</small></span>
                <UIcon
                  name="i-lucide-chevron-right"
                  class="size-5 shrink-0 text-muted"
                  aria-hidden="true"
                />
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                :to="localePath(pzRoutes.quiz)"
                class="flex min-h-14 items-center gap-3 rounded-(--pz-radius-md) border border-default px-3 py-2 hover:border-accented"
              >
                <UIcon
                  name="i-lucide-circle-help"
                  class="size-5 shrink-0"
                  aria-hidden="true"
                />
                <span class="min-w-0 flex-1"><b class="block">Kviz riječi</b><small class="text-muted">Što znači domaća riječ?</small></span>
                <UIcon
                  name="i-lucide-chevron-right"
                  class="size-5 shrink-0 text-muted"
                  aria-hidden="true"
                />
              </NuxtLink>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <AppSheet
      v-model:open="sharing"
      title="Podijeli"
    >
      <PzShareOptions
        :text="shareText"
        :url="shareUrl"
        preview
        preview-lead="Ovo će se poslati. Riječ se ne otkriva."
        @copied="copied"
      />
    </AppSheet>
  </UContainer>
</template>
