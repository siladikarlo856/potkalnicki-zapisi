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
  navigateTo(localePath(`${pzRoutes.learnSession}?${q}`))
}

const topLevelTopics = computed(() =>
  props.pool.topics.filter(topic => !topic.parent && topic.status === 'live'))

const sessionHref = (query: Record<string, string>) => {
  const q = new URLSearchParams(query)
  return localePath(`${pzRoutes.learnSession}?${q}`)
}
</script>

<template>
  <div
    class="flex flex-col gap-4"
    data-testid="learn-home-panel"
  >
    <template v-if="!ready">
      <USkeleton class="h-32 w-full" />
    </template>

    <template v-else>
      <div
        v-if="showTopA"
        class="flex flex-col items-start gap-3 rounded-(--pz-radius-lg) border border-default bg-default p-4"
        data-testid="learn-home-state-a"
      >
        <p class="pz-overline text-default">
          {{ t('pz.learn.continueEyebrow') }}
        </p>
        <p class="pz-body-sm text-muted">
          {{ continueLine }}
        </p>
        <UProgress
          :model-value="continueProgress"
          :max="current!.n"
          size="sm"
          class="w-full"
        />
        <p class="pz-caption text-muted">
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
        class="flex flex-col items-start gap-3 rounded-(--pz-radius-lg) border border-default bg-default p-4"
        data-testid="learn-home-state-b"
      >
        <p class="pz-overline text-default">
          {{ t('pz.learn.reviewEyebrow') }}
        </p>
        <p class="pz-body-sm text-muted">
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
        class="flex flex-col items-start gap-3 rounded-(--pz-radius-lg) border border-default bg-default p-4"
        data-testid="learn-home-state-c"
      >
        <p class="pz-overline text-default">
          {{ t('pz.learn.firstEyebrow') }}
        </p>
        <p class="pz-body-sm text-muted">
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
        class="pz-overline text-center text-muted"
      >
        {{ t('pz.learn.orDivider') }}
      </p>

      <div
        class="flex flex-col items-start gap-3 rounded-(--pz-radius-lg) border border-default bg-default p-4"
        data-testid="learn-home-new-block"
      >
        <p class="pz-overline text-muted">
          {{ t('pz.learn.newLessonEyebrow') }}
        </p>
        <div
          class="flex flex-wrap gap-2"
          role="group"
          :aria-label="t('pz.learn.topicsGroup')"
        >
          <LearnChip
            v-for="topic in topLevelTopics"
            :key="topic.id"
            :label="`${topic.label} (${topic.count})`"
            :selected="selectedTopics.includes(topic.id)"
            @click="toggleTopic(topic.id, topic.status === 'live')"
          />
        </div>
        <p class="pz-body-sm text-muted">
          {{ t('pz.learn.newLessonMeta') }}
          <ULink
            :to="localePath(pzRoutes.learn)"
            class="inline-flex min-h-(--pz-tap-min) items-center gap-1 font-semibold text-primary"
          >
            {{ t('pz.learn.moreSettings') }}
            <UIcon
              name="i-lucide-arrow-right"
              class="size-4"
              aria-hidden="true"
            />
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
          class="pz-caption text-muted"
        >
          {{ t('pz.learn.replaceWarning') }}
        </p>
      </div>
    </template>
  </div>
</template>
