<script setup lang="ts">
import type { LearnN } from '~~/shared/utils/learn/learnState'
import type { CardPool, TopicId } from '~~/shared/utils/learn/types'
import { pluralFormHr } from '~/utils/plural'
import { formatLearnStartedAt, topicLabels } from '~/utils/learnUi'
import { sessionCardIndex } from '~~/shared/utils/learn/learnState'

const props = defineProps<{ pool: CardPool }>()

const { t } = useI18n()
const localePath = useLocalePath()
const learn = useLearnState()
const { cards, dueCount } = useProgress()

const ready = ref(false)
const selectedTopics = ref<TopicId[]>(['rijeci'])
const homeN = ref<LearnN>(10)

onMounted(() => {
  learn.load()
  selectedTopics.value = [...learn.lastTopics.value]
  homeN.value = learn.lastN.value
  ready.value = true
})

const current = computed(() => learn.current.value)

const hasAnyProgress = computed(() => Object.keys(cards.value).length > 0)

const due = computed(() => {
  if (!ready.value) return 0
  return dueCount()
})

const showTopA = computed(() => ready.value && !!current.value)
const showTopB = computed(() => ready.value && !current.value && due.value > 0)
const showTopC = computed(() => ready.value && !current.value && !hasAnyProgress.value)
const showTopBlock = computed(() => showTopA.value || showTopB.value || showTopC.value)

const continueLine = computed(() => {
  const c = current.value
  if (!c) return ''
  const labels = topicLabels(props.pool, c.topics)
  const i = sessionCardIndex(c)
  return t('pz.learn.continueLine', { topics: labels, i, n: c.n })
})

const startedLabel = computed(() => {
  const c = current.value
  if (!c) return ''
  return t('pz.learn.startedAt', { when: formatLearnStartedAt(c.startedAt) })
})

const continueProgress = computed(() => {
  const c = current.value
  if (!c) return 0
  return sessionCardIndex(c) - 1
})

const reviewCount = computed(() => Math.min(due.value, 20))

const reviewLabel = computed(() =>
  t(`pz.learn.reviewButton.${pluralFormHr(reviewCount.value)}`, { n: reviewCount.value }))

const newLessonPrimary = computed(() => !showTopBlock.value)

function toggleTopic(id: TopicId, live: boolean) {
  if (!live) return
  const set = new Set(selectedTopics.value)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  if (!set.size) return
  selectedTopics.value = [...set]
}

function startNewLesson() {
  const topics = selectedTopics.value.length ? selectedTopics.value : ['rijeci']
  learn.rememberSetup(topics, homeN.value)
  const q = new URLSearchParams()
  q.set('teme', topics.join(','))
  q.set('n', String(homeN.value))
  navigateTo(localePath(`/potkalnicko-prigorje/uci/sesija?${q}`))
}

const topLevelTopics = computed(() =>
  props.pool.topics.filter(topic => !topic.parent && topic.status === 'live'))

const sessionHref = (query: Record<string, string>) => {
  const q = new URLSearchParams(query)
  return localePath(`/potkalnicko-prigorje/uci/sesija?${q}`)
}
</script>

<template>
  <div
    class="space-y-4"
    data-testid="learn-home-panel"
  >
    <template v-if="!ready">
      <USkeleton class="h-32 w-full" />
    </template>

    <template v-else>
      <div
        v-if="showTopA"
        class="space-y-3 rounded-lg bg-elevated p-4 ring ring-default"
        data-testid="learn-home-state-a"
      >
        <p class="text-xs font-semibold tracking-wide text-primary uppercase">
          {{ t('pz.learn.continueEyebrow') }}
        </p>
        <p class="text-sm text-muted">
          {{ continueLine }}
        </p>
        <UProgress
          :model-value="continueProgress"
          :max="current!.n"
          size="sm"
        />
        <p class="text-xs text-muted">
          {{ startedLabel }}
        </p>
        <UButton
          :to="sessionHref({ nastavi: '1' })"
          :label="t('pz.learn.continueButton')"
          size="lg"
          data-testid="learn-home-continue"
        />
      </div>

      <div
        v-else-if="showTopB"
        class="space-y-3 rounded-lg bg-elevated p-4 ring ring-default"
        data-testid="learn-home-state-b"
      >
        <p class="text-xs font-semibold tracking-wide text-primary uppercase">
          {{ t('pz.learn.reviewEyebrow') }}
        </p>
        <p class="text-sm text-muted">
          {{ t('pz.learn.reviewWaiting', { due }) }}
        </p>
        <UButton
          :to="sessionHref({ ponovi: '1' })"
          :label="reviewLabel"
          size="lg"
          data-testid="learn-home-review"
        />
      </div>

      <div
        v-else-if="showTopC"
        class="space-y-3 rounded-lg bg-elevated p-4 ring ring-default"
        data-testid="learn-home-state-c"
      >
        <p class="text-xs font-semibold tracking-wide text-primary uppercase">
          {{ t('pz.learn.firstEyebrow') }}
        </p>
        <p class="text-sm text-muted">
          {{ t('pz.learn.firstBlurb') }}
        </p>
        <UButton
          :to="sessionHref({ teme: 'rijeci', n: '10' })"
          :label="t('pz.learn.firstButton')"
          size="lg"
          data-testid="learn-home-first"
        />
      </div>

      <p
        v-if="showTopBlock"
        class="text-center text-xs text-muted uppercase"
      >
        {{ t('pz.learn.orDivider') }}
      </p>

      <div
        class="space-y-3 rounded-lg p-4 ring ring-default"
        data-testid="learn-home-new-block"
      >
        <p class="text-xs font-semibold tracking-wide text-muted uppercase">
          {{ t('pz.learn.newLessonEyebrow') }}
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="topic in topLevelTopics"
            :key="topic.id"
            :label="`${topic.label} (${topic.count})`"
            :color="selectedTopics.includes(topic.id) ? 'primary' : 'neutral'"
            :variant="selectedTopics.includes(topic.id) ? 'solid' : 'outline'"
            size="sm"
            @click="toggleTopic(topic.id, topic.status === 'live')"
          />
        </div>
        <p class="text-sm text-muted">
          {{ t('pz.learn.newLessonMeta') }}
          <ULink
            :to="localePath('/potkalnicko-prigorje/uci')"
            class="font-medium text-primary"
          >
            {{ t('pz.learn.moreSettings') }}
          </ULink>
        </p>
        <UButton
          :label="t('pz.learn.newLessonButton')"
          :color="newLessonPrimary ? 'primary' : 'neutral'"
          :variant="newLessonPrimary ? 'solid' : 'outline'"
          size="lg"
          data-testid="learn-home-new-lesson"
          @click="startNewLesson"
        />
        <p
          v-if="current"
          class="text-xs text-muted"
        >
          {{ t('pz.learn.replaceWarning') }}
        </p>
      </div>
    </template>
  </div>
</template>
