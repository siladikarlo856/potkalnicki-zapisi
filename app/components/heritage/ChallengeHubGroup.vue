<script setup lang="ts">
import type { StoredChallenge } from '~~/shared/utils/challengeList'
import { challengeListGroup, daysUntilClose } from '~~/shared/utils/challengeList'
import { pzRoutes } from '~~/shared/utils/appRoutes'

const props = defineProps<{
  title?: string
  items: StoredChallenge[]
  newPlayersFor: (item: StoredChallenge) => number
  primaryAction: 'continue' | 'play' | 'leaderboard'
  showNewPlayers?: boolean
}>()

const emit = defineEmits<{ remove: [code: string], visible: [code: string] }>()

const { t } = useI18n()
const localePath = useLocalePath()

function challengePath(code: string) {
  return localePath(pzPath(pzRoutes.challenge, code))
}

function leaderboardPath(code: string) {
  return localePath(pzPath(pzRoutes.challenge, code, 'ljestvica'))
}

const primaryLabel = computed(() => {
  if (props.primaryAction === 'play') return t('challenge.playChallenge')
  if (props.primaryAction === 'leaderboard') return t('challenge.leaderboardLink')
  return t('challenge.resumeContinue')
})

const primaryTo = (code: string) => {
  if (props.primaryAction === 'leaderboard') return leaderboardPath(code)
  return challengePath(code)
}

function detail(item: StoredChallenge) {
  const last = item.last
  const played = last ? `${Math.min(last.index, last.questionCount)} od ${last.questionCount}` : ''
  const days = daysUntilClose(item.closesAt)
  if (last?.closed || last?.completedAt) {
    const finishedAt = last.completedAt ?? item.closesAt
    return t('challenge.rowFinished', { date: new Intl.DateTimeFormat('hr-HR', { dateStyle: 'long' }).format(new Date(finishedAt)) })
  }
  return t('challenge.rowActive', { played, days })
}

const listRoot = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined

function observeRows() {
  if (!import.meta.client || !listRoot.value) return
  observer?.disconnect()
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const code = (entry.target as HTMLElement).dataset.code
      if (code && entry.isIntersecting) emit('visible', code)
    }
  }, { rootMargin: '100px' })
  for (const row of listRoot.value.querySelectorAll('[data-code]')) observer.observe(row)
}

onMounted(() => {
  observeRows()
})

watch(() => props.items, () => nextTick(observeRows))

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <section class="space-y-3">
    <h2
      v-if="title"
      class="text-xl font-semibold text-highlighted"
    >
      {{ title }}
    </h2>
    <ul
      ref="listRoot"
      class="divide-y divide-default"
    >
      <li
        v-for="item in items"
        :key="item.code"
        :data-code="item.code"
        class="flex flex-col gap-3 border-b border-default py-4 sm:flex-row sm:items-center sm:justify-between"
        data-testid="challenge-hub-row"
      >
        <div class="flex min-w-0 items-start gap-3">
          <span class="grid size-10 shrink-0 place-items-center rounded-(--pz-radius-md) bg-accented text-primary">
            <UIcon
              :name="primaryAction === 'leaderboard' ? 'i-lucide-trophy' : 'i-lucide-swords'"
              class="size-5"
            />
          </span>
          <div class="min-w-0 space-y-1">
            <p class="font-semibold text-highlighted wrap-anywhere">
              {{ item.title }} · {{ item.code }}
            </p>
            <p class="text-sm text-muted">
              {{ detail(item) }}
            </p>
            <UBadge
              v-if="challengeListGroup(item) === 'inProgress' || challengeListGroup(item) === 'waiting'"
              color="warning"
              variant="subtle"
            >
              {{ t('challenge.turnWaiting') }}
            </UBadge>
            <p
              v-if="showNewPlayers && newPlayersFor(item) > 0"
              class="text-sm font-medium text-primary"
            >
              {{ t('challenge.newPlayers', { n: newPlayersFor(item) }) }}
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 sm:shrink-0">
          <UButton
            :to="primaryTo(item.code)"
            :label="primaryLabel"
            size="sm"
          />
          <UButton
            v-if="primaryAction !== 'leaderboard'"
            :to="leaderboardPath(item.code)"
            :label="t('challenge.leaderboardLink')"
            size="sm"
            color="neutral"
            variant="outline"
          />
          <UButton
            :label="t('challenge.removeFromList')"
            size="sm"
            color="neutral"
            variant="ghost"
            data-testid="challenge-remove-from-list"
            @click="emit('remove', item.code)"
          />
        </div>
      </li>
    </ul>
  </section>
</template>
