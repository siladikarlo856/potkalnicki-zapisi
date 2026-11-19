<script setup lang="ts">
import type { StoredChallenge } from '~~/shared/utils/challengeList'
import { pzRoutes } from '~~/shared/utils/appRoutes'

defineProps<{
  items: StoredChallenge[]
  newPlayersFor: (item: StoredChallenge) => number
}>()

const { t } = useI18n()
const localePath = useLocalePath()

function challengePath(code: string) {
  return localePath(pzPath(pzRoutes.challenge, code))
}

function leaderboardPath(code: string) {
  return localePath(pzPath(pzRoutes.challenge, code, 'ljestvica'))
}
</script>

<template>
  <section
    class="space-y-3"
    data-testid="active-challenges-strip"
  >
    <h2 class="text-lg font-semibold text-highlighted">
      {{ t('challenge.activeTitle') }}
    </h2>
    <ul class="divide-y divide-default rounded-lg ring ring-default">
      <li
        v-for="item in items"
        :key="item.code"
        class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        data-testid="active-challenge-row"
      >
        <div class="min-w-0 space-y-1">
          <p class="truncate font-medium text-highlighted">
            {{ item.title }}
          </p>
          <p
            v-if="newPlayersFor(item) > 0"
            class="text-sm text-primary"
          >
            {{ t('challenge.newPlayers', { n: newPlayersFor(item) }) }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            :to="challengePath(item.code)"
            :label="t('challenge.resumeContinue')"
            size="sm"
          />
          <UButton
            :to="leaderboardPath(item.code)"
            :label="t('challenge.leaderboardLink')"
            size="sm"
            color="neutral"
            variant="outline"
          />
        </div>
      </li>
    </ul>
  </section>
</template>
