<script setup lang="ts">
import type { LearnN } from '~~/shared/utils/learn/learnState'
import { sessionCardIndex } from '~~/shared/utils/learn/learnState'
import { reviewCardKeys } from '~~/shared/utils/learn/session'
import type { TopicId } from '~~/shared/utils/learn/types'
import { settlementForSlug, settlementSlugForPlace } from '~/utils/learnPlace'
import type { PlaceOption } from '~~/shared/types/place'
import { pluralFormHr } from '~/utils/plural'

// Uči: home of spaced-repetition learning. What is due today, where to find new words, how much is known. Three
// states of the "Danas" card: words due, nothing due, and the first visit (pick where to start).
definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { pool, status, error, refresh } = useCardPool()
const learn = useLearnState()
const { cards, dueCount, learnedCount, nextReview } = useProgress()

useSeoMeta({
  title: () => t('pz.learn.seoTitle'),
  ogTitle: () => `${t('pz.learn.title')} · Potkalnički zapisi`,
  description: 'Kartice s riječima domaćega govora.',
  ogDescription: 'Kartice s riječima domaćega govora.'
})

const ready = ref(false)
const n = ref<LearnN>(10)
const lengths: LearnN[] = [5, 10, 20]
const firstPick = ref<'rijeci' | TopicId | 'mjesto'>('rijeci')
const requestedTopics = computed(() => typeof route.query.teme === 'string' ? route.query.teme.split(',').map(topic => topic.trim()).filter(Boolean) : [])
watch(requestedTopics, (topics) => {
  firstPick.value = topics.length ? topics.join(',') : 'rijeci'
}, { immediate: true })
const placeSlug = ref<string | undefined>()
const placeId = ref<string | null>(null)
const placeQuery = ref('')

const topics = computed(() => pool.value.topics.filter(topic => !topic.parent && topic.status === 'live'))
const hasProgress = computed(() => ready.value && Object.keys(cards.value).length > 0)
const current = computed(() => ready.value ? learn.current.value : null)
const firstTime = computed(() => ready.value && !hasProgress.value && !current.value)
const reviewKeys = computed(() => reviewCardKeys(pool.value, placeSlug.value))
const due = computed(() => ready.value ? dueCount(reviewKeys.value) : 0)
const known = computed(() => ready.value ? learnedCount() : 0)
const learning = computed(() => Math.max(0, Object.keys(cards.value).length - known.value))
const reviewCount = computed(() => Math.min(due.value, 20))
const upcoming = computed(() => ready.value && due.value === 0 ? nextReview(reviewKeys.value) : null)
const upcomingWhen = computed(() => {
  const days = upcoming.value?.inDays ?? 0
  if (days === 1) return 'sutra'
  if (days === 2) return 'prekosutra'
  return `za ${days} ${days % 10 === 1 && days % 100 !== 11 ? 'dan' : 'dana'}`
})
const minutes = computed(() => Math.max(1, Math.round(reviewCount.value / 3)))
const cardsWord = (count: number) => t(`pz.learn.startCards.${pluralFormHr(count)}`, { n: count }).replace(/^Započni \S+ /, '')

const topicRows = computed(() => topics.value.map((topic) => {
  const keys = pool.value.cards.filter(card => card.topics.includes(topic.id)).map(card => card.key)
  const knownHere = ready.value ? learnedCount(keys) : 0
  return { ...topic, known: knownHere, started: keys.some(key => Object.hasOwn(cards.value, key)) }
}))

function sessionHref(query: Record<string, string>) {
  return localePath(`${pzRoutes.learnSession}?${new URLSearchParams(query)}`)
}
const reviewHref = computed(() => sessionHref({ ponovi: '1', ...(placeSlug.value ? { mjesto: placeSlug.value } : {}) }))
const continueHref = computed(() => sessionHref({ nastavi: '1' }))
const newHref = computed(() => {
  const query: Record<string, string> = { teme: (requestedTopics.value.length ? requestedTopics.value : learn.lastTopics.value).join(','), n: String(n.value) }
  if (placeSlug.value) query.mjesto = placeSlug.value
  return sessionHref(query)
})
const topicHref = (id: TopicId) => sessionHref({ teme: id, n: String(n.value) })
const startHref = computed(() => {
  const query: Record<string, string> = { teme: firstPick.value === 'mjesto' ? 'rijeci' : firstPick.value, n: '10' }
  if (firstPick.value === 'mjesto' && placeSlug.value) query.mjesto = placeSlug.value
  return sessionHref(query)
})

async function onPlaceSelection(id: string | null) {
  if (!id) {
    placeSlug.value = undefined
    learn.rememberPlace(undefined)
    return
  }
  const q = placeQuery.value.trim()
  if (q.length < 2) return
  try {
    const response = await $fetch<{ places: PlaceOption[] }>('/api/places', { query: { q }, retry: 0 })
    const match = response.places.find(p => p.id === id)
    if (!match) return
    placeSlug.value = settlementSlugForPlace(pool.value, match)
    learn.rememberPlace(placeSlug.value)
  } catch {
    // keep the picker selection; the slug can wait for the next pool load
  }
}

function clearPlace() {
  placeId.value = null
  placeQuery.value = ''
  placeSlug.value = undefined
  learn.rememberPlace(undefined)
}

watch(n, () => learn.rememberSetup(requestedTopics.value.length ? requestedTopics.value : learn.lastTopics.value, n.value))

onMounted(() => {
  learn.load()
  n.value = learn.lastN.value
  const qn = Number(route.query.n)
  if (qn === 5 || qn === 10 || qn === 20) n.value = qn
  placeSlug.value = typeof route.query.mjesto === 'string' && route.query.mjesto.trim() ? route.query.mjesto.trim() : learn.place.value
  ready.value = true
})
watch([() => status.value, placeSlug], () => {
  if (status.value !== 'success') return
  const settlement = settlementForSlug(pool.value, placeSlug.value)
  placeQuery.value = settlement?.name ?? ''
  if (!settlement) placeId.value = null
})
</script>

<template>
  <UContainer class="py-4 lg:py-6">
    <div
      class="mx-auto flex w-full flex-col"
      :class="firstTime && !error ? 'max-w-(--pz-game-col)' : 'max-w-(--pz-page-max)'"
    >
      <PageHead
        :title="t('pz.learn.title')"
        :lead="firstTime && !error ? 'Odaberi odakle želiš početi. Dobit ćeš deset kartica, a ostalo dolazi samo.' : 'Kartice s riječima domaćega govora. Riječi koje teže pamtiš vraćaju se češće, one koje znaš rjeđe.'"
      />

      <div
        v-if="!ready || status === 'pending'"
        class="grid gap-4 lg:grid-cols-12"
        aria-busy="true"
      >
        <p
          class="sr-only"
          role="status"
        >
          Učitavanje…
        </p>
        <USkeleton class="h-60 w-full rounded-(--pz-radius-lg) lg:col-span-5" />
        <USkeleton class="h-60 w-full rounded-(--pz-radius-lg) lg:col-span-7" />
      </div>

      <PageState
        v-else-if="error"
        kind="error"
        title="Riječi za učenje nismo uspjeli učitati"
        description="Tvoj je napredak sačuvan na uređaju. Pokušaj ponovno za koji trenutak."
        @retry="refresh()"
      />

      <div
        v-else-if="firstTime"
        class="flex flex-col gap-5"
        data-testid="learn-setup"
      >
        <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
          <legend class="pz-h3 mb-2 text-highlighted">
            Prve riječi
          </legend>
          <label
            v-for="option in [{ id: 'rijeci', label: 'Najčešće riječi', sub: 'Riječi domaćega govora iz svakog sela.' }, ...topics.filter(topic => topic.id !== 'rijeci').map(topic => ({ id: topic.id, label: topic.label, sub: `${topic.count} kartica` })), { id: 'mjesto', label: 'Riječi iz jednog naselja', sub: 'Odaberi svoje selo.' }]"
            :key="option.id"
            class="flex min-h-14 cursor-pointer items-center gap-3 rounded-(--pz-radius-md) border border-default px-3 py-2 has-checked:border-2 has-checked:border-(--ui-text) has-checked:bg-elevated has-focus-visible:outline-2 has-focus-visible:outline-offset-2"
          >
            <input
              v-model="firstPick"
              type="radio"
              name="first-pick"
              :value="option.id"
              class="size-5 accent-(--ui-text)"
            >
            <span class="min-w-0 flex-1"><b class="block">{{ option.label }}</b><small class="text-muted">{{ option.sub }}</small></span>
          </label>
        </fieldset>
        <div
          v-if="firstPick === 'mjesto'"
          class="flex flex-col gap-2"
          data-testid="learn-place"
        >
          <HeritagePlacePicker
            v-model="placeId"
            v-model:query="placeQuery"
            @selection="onPlaceSelection"
          />
          <p class="pz-body-sm text-muted">
            {{ t('pz.learn.wordsNoPlaceData') }}
          </p>
        </div>
        <UButton
          :to="startHref"
          label="Počni s 10 kartica"
          icon="i-lucide-play"
          size="xl"
          block
          data-testid="learn-setup-start"
        />
        <p class="pz-caption text-center text-muted">
          Bez računa. Napredak se čuva na ovom uređaju.
        </p>
      </div>

      <div
        v-else
        class="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start"
        data-testid="learn-hub"
      >
        <section
          class="flex flex-col gap-4 rounded-(--pz-radius-lg) border border-default bg-default p-4 sm:p-5 lg:col-span-5"
          aria-labelledby="learn-today"
          data-testid="learn-today"
        >
          <h2
            id="learn-today"
            class="pz-h3 text-highlighted"
          >
            Danas
          </h2>
          <dl class="m-0 grid grid-cols-3 gap-2 text-center">
            <div
              v-for="stat in [{ n: due, l: 'za ponavljanje' }, { n: known, l: 'znaš' }, { n: learning, l: 'učiš' }]"
              :key="stat.l"
              class="rounded-(--pz-radius-md) bg-elevated px-2 py-3"
            >
              <dd class="pz-h2 m-0 tabular-nums text-highlighted">
                {{ stat.n }}
              </dd>
              <dt class="pz-caption text-muted">
                {{ stat.l }}
              </dt>
            </div>
          </dl>
          <template v-if="due > 0">
            <UButton
              :to="reviewHref"
              label="Počni ponavljanje"
              icon="i-lucide-play"
              size="xl"
              block
              data-testid="learn-home-review"
            />
            <p class="pz-caption text-center text-muted">
              {{ reviewCount }} {{ cardsWord(reviewCount) }}, oko {{ minutes }} {{ minutes === 1 ? 'minutu' : minutes < 5 ? 'minute' : 'minuta' }}
            </p>
          </template>
          <div
            v-else
            class="flex flex-col items-center gap-1 py-2 text-center"
          >
            <UIcon
              name="i-lucide-check"
              class="size-8 text-success"
              aria-hidden="true"
            />
            <p><b>Za danas je sve ponovljeno.</b></p>
            <p
              v-if="upcoming"
              class="pz-caption text-muted"
              data-testid="learn-home-next-review"
            >
              Sljedeće ponavljanje: {{ upcomingWhen }}, {{ upcoming.count }} {{ cardsWord(upcoming.count) }}.
            </p>
          </div>
          <UButton
            v-if="current"
            :to="continueHref"
            :label="`Nastavi sesiju (kartica ${sessionCardIndex(current)} od ${current.n})`"
            color="neutral"
            variant="outline"
            block
            data-testid="learn-home-continue"
          />
          <UButton
            v-if="due === 0"
            :to="newHref"
            label="Nauči nove riječi"
            icon="i-lucide-plus"
            size="xl"
            block
            data-testid="learn-home-new-lesson"
          />
        </section>

        <div class="flex flex-col gap-8 lg:col-span-7">
          <section aria-labelledby="learn-new">
            <h2
              id="learn-new"
              class="pz-h2 mb-2 text-highlighted"
            >
              Nove riječi po temama
            </h2>
            <ul class="m-0 flex list-none flex-col gap-2 p-0">
              <li
                v-for="topic in topicRows"
                :key="topic.id"
              >
                <NuxtLink
                  :to="topicHref(topic.id)"
                  class="flex min-h-14 items-center gap-3 rounded-(--pz-radius-md) border border-default px-3 py-2 hover:border-accented"
                  data-testid="learn-topic-row"
                >
                  <span class="min-w-0 flex-1"><b class="block">{{ topic.label }}</b><small class="text-muted">{{ topic.count }} {{ cardsWord(topic.count) }} · {{ topic.started ? `znaš ${topic.known}` : 'još nije započeto' }}</small></span>
                  <UIcon
                    name="i-lucide-chevron-right"
                    class="size-5 shrink-0 text-muted"
                    aria-hidden="true"
                  />
                </NuxtLink>
              </li>
            </ul>
          </section>

          <section
            class="flex flex-col gap-4 rounded-(--pz-radius-lg) bg-elevated p-4 sm:p-5"
            aria-labelledby="learn-settings"
          >
            <h2
              id="learn-settings"
              class="pz-h3 text-highlighted"
            >
              Postavke učenja
            </h2>
            <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
              <legend class="mb-1 text-sm font-semibold">
                Kartica po sesiji
              </legend>
              <div
                class="flex gap-2"
                role="group"
                :aria-label="t('pz.learn.lengthGroup')"
              >
                <LearnChip
                  v-for="len in lengths"
                  :key="len"
                  :label="String(len)"
                  :selected="n === len"
                  @click="n = len"
                />
              </div>
            </fieldset>
            <div
              class="flex flex-col gap-2"
              data-testid="learn-place"
            >
              <p class="text-sm font-semibold">
                {{ t('pz.learn.myPlace') }}
              </p>
              <HeritagePlacePicker
                v-model="placeId"
                v-model:query="placeQuery"
                @selection="onPlaceSelection"
              />
              <UButton
                v-if="placeSlug"
                :label="t('pz.learn.changePlace')"
                color="neutral"
                variant="link"
                class="min-h-(--pz-tap-min) self-start px-0"
                @click="clearPlace"
              />
            </div>
            <p class="pz-caption text-muted">
              Napredak se čuva samo na ovom uređaju.
            </p>
          </section>
        </div>
      </div>
    </div>
  </UContainer>
</template>
