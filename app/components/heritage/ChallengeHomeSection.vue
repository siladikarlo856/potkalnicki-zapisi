<script setup lang="ts">
import { onMounted } from 'vue'
import { pzRoutes } from '~~/shared/utils/appRoutes'

const { t } = useI18n()
const localePath = useLocalePath()
const {
  totalCount,
  homeHighlight,
  resetRefreshBudget,
  refreshItem,
  items,
  newPlayersFor
} = useChallengeList()

onMounted(async () => {
  resetRefreshBudget()
  for (const item of items.value.slice(0, 3)) {
    await refreshItem(item.code, { fetchLeaderboard: item.role === 'creator' })
  }
})
</script>

<template>
  <div
    class="mx-auto w-full max-w-2xl px-4 pb-6"
    data-testid="friend-challenge"
  >
    <template v-if="totalCount === 0">
      <UCard variant="outline">
        <div class="space-y-3">
          <h2 class="text-lg font-semibold text-highlighted">
            {{ t('challenge.friendTitle') }}
          </h2>
          <p class="text-sm text-muted">
            {{ t('pz.home.friendChallengeBlurb') }}
          </p>
          <UButton
            :to="localePath(pzRoutes.challenge)"
            :label="t('pz.home.friendChallengeCta')"
            trailing-icon="i-lucide-arrow-right"
          />
        </div>
      </UCard>
    </template>
    <template v-else>
      <HeritageChallengeResumeCard
        v-if="homeHighlight"
        :item="homeHighlight"
      />
      <div class="mt-3 flex flex-wrap gap-2">
        <UButton
          :to="localePath(pzRoutes.challenge)"
          :label="t('challenge.allChallenges', { k: totalCount })"
          color="neutral"
          variant="outline"
          data-testid="challenge-all-link"
        />
        <UButton
          :to="localePath(`${pzRoutes.challenge}/novi`)"
          :label="t('challenge.makeChallenge')"
          icon="i-lucide-plus"
          data-testid="challenge-make-link"
        />
      </div>
      <p
        v-if="homeHighlight && newPlayersFor(homeHighlight) > 0"
        class="mt-2 text-sm text-primary"
      >
        {{ t('challenge.newPlayers', { n: newPlayersFor(homeHighlight) }) }}
      </p>
    </template>
  </div>
</template>
