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
  <PzChallengeCard
    :overline="t('pz.home.challengeOverline')"
    :title="t('pz.home.challengeTitle')"
    data-testid="friend-challenge"
  >
    <template v-if="totalCount === 0">
      <p class="pz-body relative text-inverted">
        {{ t('pz.home.friendChallengeBlurb') }}
      </p>
      <UButton
        :to="localePath(pzRoutes.challenge)"
        :label="t('pz.home.friendChallengeCta')"
        icon="i-lucide-flag"
        size="lg"
        color="neutral"
        block
        class="relative bg-(--pz-wheat) text-default hover:bg-(--pz-wheat) hover:brightness-95"
      />
    </template>
    <template v-else>
      <HeritageChallengeResumeCard
        v-if="homeHighlight"
        :item="homeHighlight"
      />
      <p
        v-if="homeHighlight && newPlayersFor(homeHighlight) > 0"
        class="pz-body-sm relative text-inverted"
      >
        {{ t('challenge.newPlayers', { n: newPlayersFor(homeHighlight) }) }}
      </p>
      <div class="relative flex flex-wrap gap-2">
        <UButton
          :to="localePath(pzRoutes.challenge)"
          :label="t('challenge.allChallenges', { k: totalCount })"
          color="neutral"
          variant="outline"
          class="bg-transparent text-inverted ring-current hover:bg-transparent hover:underline"
          data-testid="challenge-all-link"
        />
        <UButton
          :to="localePath(pzRoutes.challengeNew)"
          :label="t('challenge.makeChallenge')"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          class="bg-transparent text-inverted ring-current hover:bg-transparent hover:underline"
          data-testid="challenge-make-link"
        />
      </div>
    </template>
  </PzChallengeCard>
</template>
