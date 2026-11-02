<script setup lang="ts">
import type { WordEntry } from '~/types/heritage'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

// The words stay Croatian, but the game's controls and messages follow the page language.
const { locale, t } = useI18n()
const localePath = useLocalePath()
const { words, status, error, refresh } = useHeritage()
const { recordSeen, recordKnown, recordMissed, totals } = useProgress()

useSeoMeta({
  title: 'Kaj to znači?',
  ogTitle: 'Kaj to znači? · Potkalnički zapisi',
  description: () => t('game.description'),
  ogDescription: () => t('game.description')
})

const deck = shallowRef<WordEntry[]>([])
const missed = shallowRef<WordEntry[]>([])
const index = ref(0)
const flipped = ref(false)
const seen = ref(false)
const known = ref(0)
const unknown = ref(0)
const variantOpen = ref(false)

const flipControl = useTemplateRef<HTMLElement>('flipControl')
const restartControl = useTemplateRef<HTMLElement>('restartControl')

const entry = computed(() => deck.value[index.value])
const hasSampleWords = computed(() => words.value.some(word => word.status === 'placeholder'))
const announcement = ref<{ text: string, word?: string }>({ text: '' })

watch(words, (available) => {
  if (!deck.value.length && available.length) deck.value = [...available]
}, { immediate: true })

function pluralForm(n: number) {
  const one = locale.value === 'hr' ? n % 10 === 1 && n % 100 !== 11 : n === 1
  return one ? 'one' : 'other'
}

const missedWords = computed(() => {
  const n = missed.value.length
  const form = pluralForm(n)
  return {
    heading: t(`game.missed.${form}`),
    repeat: t(`game.repeat.${form}`, { n })
  }
})

function resultText() {
  const total = deck.value.length
  return t(`game.result.${pluralForm(total)}`, { known: known.value, total })
}

function announceCard() {
  announcement.value = {
    text: `${t('game.counter', { current: index.value + 1, total: deck.value.length })}: `,
    word: entry.value?.headword
  }
}

watch(flipped, (value) => {
  if (value && !seen.value) {
    seen.value = true
    if (entry.value) recordSeen(entry.value.id)
  }
})

async function score(knewIt: boolean) {
  if (!entry.value || !seen.value) return
  if (knewIt) recordKnown(entry.value.id)
  else recordMissed(entry.value.id)
  if (knewIt) known.value++
  else {
    unknown.value++
    if (entry.value) missed.value = [...missed.value, entry.value]
  }
  index.value++
  flipped.value = false
  seen.value = false
  if (entry.value) announceCard()
  else announcement.value = { text: `${t('game.done')} ${resultText()}` }
  await nextTick()
  const next = entry.value ? flipControl.value : restartControl.value
  next?.querySelector('button')?.focus()
}

// While the report dialog is open the arrow keys belong to it, not to the cards behind it.
defineShortcuts(computed(() => ({
  arrowleft: entry.value && seen.value && !variantOpen.value ? () => score(false) : false,
  arrowright: entry.value && seen.value && !variantOpen.value ? () => score(true) : false
})))

function shuffled(cards: WordEntry[]) {
  const copy = [...cards]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const card = copy[i]!
    copy[i] = copy[j]!
    copy[j] = card
  }
  return copy
}

async function restart(cards: WordEntry[] = words.value) {
  deck.value = shuffled(cards)
  missed.value = []
  index.value = 0
  known.value = 0
  unknown.value = 0
  flipped.value = false
  seen.value = false
  announceCard()
  await nextTick()
  flipControl.value?.querySelector('button')?.focus()
}
</script>

<template>
  <UContainer class="py-3 sm:py-5 lg:py-6">
    <div
      class="mx-auto grid w-full max-w-md gap-3 lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-12 lg:gap-y-6"
    >
      <p
        class="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ announcement.text }}<span
          v-if="announcement.word"
          lang="hr"
        >{{ announcement.word }}</span>
      </p>

      <header class="lg:col-start-1 lg:row-start-1">
        <UButton
          :to="localePath('/potkalnicko-prigorje')"
          :label="t('heritage.title')"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="link"
          size="sm"
          class="-ms-0.5 mb-1 px-0"
        />
        <h1
          class="text-2xl font-bold tracking-tight text-highlighted sm:text-3xl"
          lang="hr"
        >
          Kaj to znači?
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ t('game.intro') }}
        </p>
        <p class="mt-1 text-xs text-muted">
          {{ t('game.progressCount', { count: totals.known + totals.missed }) }}
        </p>
      </header>

      <div
        class="flex min-w-0 flex-col gap-2.5 lg:col-start-2 lg:row-span-2 lg:row-start-1"
      >
        <template v-if="entry">
          <div class="flex items-center justify-between gap-2 text-sm text-muted">
            <span>{{ t('game.counter', { current: index + 1, total: deck.length }) }}</span>
            <span class="flex gap-3">
              <span class="flex items-center gap-1">
                <UIcon
                  name="i-lucide-check"
                  class="size-4 text-primary"
                />
                <span class="sr-only">{{ t('game.known') }}:</span>
                {{ known }}
              </span>
              <span class="flex items-center gap-1">
                <UIcon
                  name="i-lucide-x"
                  class="size-4"
                />
                <span class="sr-only">{{ t('game.unknown') }}:</span>
                {{ unknown }}
              </span>
            </span>
          </div>
          <UProgress
            :model-value="index"
            :max="deck.length"
            size="sm"
            aria-hidden="true"
          />

          <HeritageWordFlipCard
            :key="entry.id"
            v-model:flipped="flipped"
            :entry="entry"
            :english="locale === 'en'"
            @contribute="variantOpen = true"
          />

          <div
            ref="flipControl"
            class="print:hidden"
          >
            <UButton
              :label="flipped ? t('game.flipBack') : t('game.flip')"
              icon="i-lucide-rotate-3d"
              :color="seen ? 'neutral' : 'primary'"
              :variant="seen ? 'outline' : 'solid'"
              size="xl"
              block
              @click="flipped = !flipped"
            />
          </div>
          <div
            v-if="seen"
            class="grid grid-cols-2 gap-2 print:hidden"
          >
            <UButton
              :label="t('game.unknown')"
              icon="i-lucide-x"
              color="neutral"
              variant="subtle"
              size="xl"
              block
              aria-keyshortcuts="ArrowLeft"
              @click="score(false)"
            >
              <template #trailing>
                <UKbd
                  value="arrowleft"
                  aria-hidden="true"
                  class="hidden pointer-fine:inline-flex"
                />
              </template>
            </UButton>
            <UButton
              :label="t('game.known')"
              icon="i-lucide-check"
              size="xl"
              block
              aria-keyshortcuts="ArrowRight"
              @click="score(true)"
            >
              <template #trailing>
                <UKbd
                  value="arrowright"
                  aria-hidden="true"
                  class="hidden pointer-fine:inline-flex"
                />
              </template>
            </UButton>
          </div>

          <UButton
            :label="t('game.differently')"
            icon="i-lucide-message-square-plus"
            color="neutral"
            variant="link"
            size="sm"
            class="self-start px-0 print:hidden"
            aria-haspopup="dialog"
            @click="variantOpen = true"
          />

          <HeritageVariantDialog
            v-model:open="variantOpen"
            :entry="entry"
          />
        </template>

        <div
          v-else-if="error || status === 'pending' || !words.length"
          class="rounded-xl bg-default p-6 ring ring-default"
          role="status"
        >
          <p>{{ error ? t('game.loadError') : (status === 'pending' || status === 'idle') ? t('game.loading') : t('game.empty') }}</p>
          <UButton
            v-if="error"
            :label="t('game.retry')"
            variant="link"
            @click="refresh()"
          />
        </div>
        <div
          v-else
          class="flex max-h-[calc(100svh-13rem)] flex-col items-center gap-3 overflow-y-auto rounded-xl bg-default p-4 text-center ring ring-default sm:p-6"
        >
          <span class="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <UIcon
              name="i-lucide-party-popper"
              class="size-6"
            />
          </span>
          <h2 class="text-xl font-bold text-highlighted">
            {{ t('game.done') }}
          </h2>
          <p class="text-sm text-muted">
            {{ resultText() }}
          </p>
          <div
            ref="restartControl"
            class="flex w-full flex-col items-center gap-1 print:hidden"
          >
            <UButton
              v-if="missed.length"
              :label="missedWords.repeat"
              icon="i-lucide-repeat"
              @click="restart(missed)"
            />
            <UButton
              :label="t('game.playAgain')"
              icon="i-lucide-rotate-ccw"
              :color="missed.length ? 'neutral' : 'primary'"
              :variant="missed.length ? 'subtle' : 'solid'"
              @click="restart()"
            />
            <UButton
              :to="{ path: localePath('/potkalnicko-prigorje/doprinesi'), query: { vrsta: 'rijec' } }"
              :label="t('game.differently')"
              icon="i-lucide-message-square-plus"
              color="neutral"
              variant="link"
              size="sm"
              :ui="{ label: 'whitespace-normal text-start' }"
            />
          </div>
          <div
            v-if="missed.length"
            class="w-full rounded-lg bg-muted/50 p-3 text-start text-sm"
          >
            <h3 class="mb-1.5 font-semibold text-highlighted">
              {{ missedWords.heading }}
            </h3>
            <ul class="flex flex-col gap-1">
              <li
                v-for="word in missed"
                :key="word.id"
              >
                <span lang="hr"><span class="font-semibold text-highlighted">{{ word.headword }}</span>
                  <span class="text-muted">&nbsp;— </span>{{ word.meaning.hr }}</span><span
                  v-if="locale === 'en' && word.meaning.en"
                  class="text-muted"
                  lang="en"
                > ({{ word.meaning.en }})</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2 lg:col-start-1 lg:row-start-2">
        <UAlert
          v-if="locale === 'en'"
          :title="t('game.languageNote')"
          icon="i-lucide-languages"
          color="neutral"
          variant="subtle"
        />
        <UAlert
          v-if="hasSampleWords"
          :title="t('game.sampleNote.title')"
          :description="t('game.sampleNote.description')"
          icon="i-lucide-triangle-alert"
          color="neutral"
          variant="outline"
          :ui="{ icon: 'text-warning' }"
        />
        <UButton
          :to="localePath('/potkalnicko-prigorje/igre/kviz')"
          :label="t('quiz.tryQuiz')"
          :lang="locale"
          icon="i-lucide-list-checks"
          color="neutral"
          variant="outline"
          block
        />
      </div>
    </div>
  </UContainer>
</template>
