<script setup lang="ts">
import type { LearnN } from '~~/shared/utils/learn/learnState'
import type { TopicId } from '~~/shared/utils/learn/types'
import { pluralFormHr } from '~/utils/plural'
import { settlementForSlug, settlementSlugForPlace } from '~/utils/learnPlace'
import type { PlaceOption } from '~~/shared/types/place'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const { pool, status, error, refresh } = useCardPool()
const learn = useLearnState()

useSeoMeta({
  title: () => t('pz.learn.seoTitle'),
  ogTitle: () => `${t('pz.learn.title')} · Potkalnički zapisi`,
  description: () => t('pz.learn.pickTopics'),
  ogDescription: () => t('pz.learn.pickTopics')
})

const ready = ref(false)
const selectedParent = ref<TopicId | null>(null)
const selected = ref<Set<TopicId>>(new Set(['rijeci']))
const n = ref<LearnN>(10)
const placeSlug = ref<string | undefined>()
const placeId = ref<string | null>(null)
const placeQuery = ref('')

const lengths: LearnN[] = [5, 10, 20]

const topTopics = computed(() => pool.value.topics.filter(topic => !topic.parent))
const childTopics = computed(() => {
  if (!selectedParent.value) return []
  return pool.value.topics.filter(topic => topic.parent === selectedParent.value)
})

const startLabel = computed(() =>
  t(`pz.learn.startCards.${pluralFormHr(n.value)}`, { n: n.value }))

function syncFromQuery() {
  const teme = route.query.teme
  if (typeof teme === 'string' && teme) {
    selected.value = new Set(teme.split(',').filter(Boolean) as TopicId[])
  }
  const qn = Number(route.query.n)
  if (qn === 5 || qn === 10 || qn === 20) n.value = qn
  const mjesto = route.query.mjesto
  if (typeof mjesto === 'string' && mjesto.trim()) placeSlug.value = mjesto.trim()
}

function syncPlacePickerFromSlug() {
  const settlement = settlementForSlug(pool.value, placeSlug.value)
  if (!settlement) {
    placeId.value = null
    placeQuery.value = ''
    return
  }
  placeQuery.value = settlement.name
}

function syncToQuery() {
  const teme = [...selected.value].join(',')
  const query: Record<string, string> = { teme, n: String(n.value) }
  if (placeSlug.value) query.mjesto = placeSlug.value
  router.replace({ query })
}

async function onPlaceSelection(id: string | null) {
  if (!id) {
    clearPlace()
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
    syncToQuery()
  } catch {
    // keep the picker selection; slug sync can wait for the next pool load
  }
}

function clearPlace() {
  placeId.value = null
  placeQuery.value = ''
  placeSlug.value = undefined
  learn.rememberPlace(undefined)
  syncToQuery()
}

function toggleTopic(topic: { id: TopicId, status: string, parent?: TopicId, soonHref?: string }) {
  if (topic.status === 'soon' && topic.soonHref) {
    navigateTo(topic.soonHref)
    return
  }
  if (topic.status !== 'live') return
  if (!topic.parent) {
    selectedParent.value = selectedParent.value === topic.id ? null : topic.id
  }
  const next = new Set(selected.value)
  if (next.has(topic.id)) next.delete(topic.id)
  else next.add(topic.id)
  if (next.size) {
    selected.value = next
    syncToQuery()
  }
}

function startHref() {
  const teme = [...selected.value].join(',')
  let href = localePath(`/potkalnicko-prigorje/uci/sesija?teme=${encodeURIComponent(teme)}&n=${n.value}`)
  if (placeSlug.value) href += `&mjesto=${encodeURIComponent(placeSlug.value)}`
  return href
}

watch(n, () => {
  learn.rememberSetup([...selected.value], n.value)
  syncToQuery()
})

onMounted(() => {
  learn.load()
  n.value = learn.lastN.value
  if (learn.lastTopics.value.length) {
    selected.value = new Set(learn.lastTopics.value)
  }
  if (learn.place.value) placeSlug.value = learn.place.value
  syncFromQuery()
  ready.value = true
})

watch(() => status.value, (s) => {
  if (s === 'success') syncPlacePickerFromSlug()
})

watch(placeSlug, () => {
  if (status.value === 'success') syncPlacePickerFromSlug()
})
</script>

<template>
  <UContainer class="py-6">
    <UButton
      :to="localePath('/potkalnicko-prigorje')"
      :label="t('heritage.title')"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="link"
      size="sm"
      class="-ms-0.5 mb-2 px-0"
    />
    <h1 class="text-2xl font-bold text-highlighted">
      {{ t('pz.learn.title') }}
    </h1>

    <div
      v-if="!ready || status === 'pending'"
      class="mt-6 space-y-3"
    >
      <USkeleton class="h-10 w-full" />
      <USkeleton class="h-32 w-full" />
    </div>

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      :title="t('pz.learn.loadError')"
      class="mt-6"
    >
      <UButton
        :label="t('game.retry')"
        variant="link"
        @click="refresh()"
      />
    </UAlert>

    <div
      v-else
      class="mt-6 space-y-6"
      data-testid="learn-setup"
    >
      <section>
        <h2 class="mb-2 text-sm font-semibold text-highlighted">
          {{ t('pz.learn.pickTopics') }}
        </h2>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="topic in topTopics"
            :key="topic.id"
            :label="`${topic.label} (${topic.count})`"
            :color="selected.has(topic.id) ? 'primary' : 'neutral'"
            :variant="selected.has(topic.id) ? 'solid' : 'outline'"
            :disabled="topic.status === 'soon'"
            size="sm"
            @click="toggleTopic(topic)"
          />
        </div>
        <div
          v-if="childTopics.length"
          class="mt-2 flex flex-wrap gap-2 ps-2"
        >
          <UButton
            v-for="topic in childTopics"
            :key="topic.id"
            :label="`${topic.label} (${topic.count})`"
            :color="selected.has(topic.id) ? 'primary' : 'neutral'"
            :variant="selected.has(topic.id) ? 'solid' : 'outline'"
            size="sm"
            @click="toggleTopic(topic)"
          />
        </div>
      </section>

      <section data-testid="learn-place">
        <h2 class="mb-2 text-sm font-semibold text-highlighted">
          {{ t('pz.learn.myPlace') }}
        </h2>
        <HeritagePlacePicker
          v-model="placeId"
          v-model:query="placeQuery"
          @selection="onPlaceSelection"
        />
        <p
          v-if="placeSlug"
          class="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted"
        >
          <span>{{ settlementForSlug(pool, placeSlug)?.name }}</span>
          <UButton
            :label="t('pz.learn.changePlace')"
            color="neutral"
            variant="link"
            size="xs"
            class="px-0"
            @click="clearPlace"
          />
        </p>
        <p
          v-if="placeSlug && selected.has('rijeci')"
          class="mt-2 text-xs text-muted"
        >
          {{ t('pz.learn.wordsNoPlaceData') }}
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-sm font-semibold text-highlighted">
          {{ t('pz.learn.pickLength') }}
        </h2>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="len in lengths"
            :key="len"
            :label="String(len)"
            :color="n === len ? 'primary' : 'neutral'"
            :variant="n === len ? 'solid' : 'outline'"
            size="sm"
            @click="n = len"
          />
        </div>
      </section>

      <p class="text-xs text-muted">
        {{ t('pz.learn.deviceNote') }}
      </p>

      <UButton
        :to="startHref()"
        :label="startLabel"
        size="xl"
        block
        data-testid="learn-setup-start"
        @click="learn.rememberSetup([...selected], n)"
      />
    </div>
  </UContainer>
</template>
