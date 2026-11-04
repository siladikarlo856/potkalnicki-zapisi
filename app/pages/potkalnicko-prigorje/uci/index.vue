<script setup lang="ts">
import type { LearnN } from '~~/shared/utils/learn/learnState'
import type { TopicId } from '~~/shared/utils/learn/types'
import { pluralFormHr } from '~/utils/plural'

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
}

function syncToQuery() {
  const teme = [...selected.value].join(',')
  router.replace({ query: { teme, n: String(n.value) } })
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
  return localePath(`/potkalnicko-prigorje/uci/sesija?teme=${encodeURIComponent(teme)}&n=${n.value}`)
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
  syncFromQuery()
  ready.value = true
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
