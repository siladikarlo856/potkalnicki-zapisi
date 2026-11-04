<script setup lang="ts">
import type { StoredChallenge } from '~~/shared/utils/challengeList'
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
  return localePath(`${pzRoutes.challenge}/${code}`)
}

function leaderboardPath(code: string) {
  return localePath(`${pzRoutes.challenge}/${code}/ljestvica`)
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
      class="divide-y divide-default rounded-lg ring ring-default"
    >
      <li
        v-for="item in items"
        :key="item.code"
        :data-code="item.code"
        class="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        data-testid="challenge-hub-row"
      >
        <div class="min-w-0 space-y-1">
          <p class="font-medium text-highlighted">
            {{ item.title }}
          </p>
          <p
            v-if="showNewPlayers && newPlayersFor(item) > 0"
            class="text-sm text-primary"
          >
            {{ t('challenge.newPlayers', { n: newPlayersFor(item) }) }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
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
