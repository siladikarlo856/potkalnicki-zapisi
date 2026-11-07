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
  <section
    class="relative flex flex-col gap-4 overflow-hidden rounded-(--pz-radius-xl) border border-inverted bg-inverted p-5 pb-24 text-inverted"
    aria-labelledby="friend-challenge-title"
    data-testid="friend-challenge"
  >
    <PzRidge class="absolute -right-2.5 bottom-0 h-22 w-[70%] text-primary opacity-90" />
    <p class="pz-overline relative text-inverted">
      {{ t('pz.home.challengeOverline') }}
    </p>
    <h2
      id="friend-challenge-title"
      class="relative font-serif text-2xl/[30px] font-semibold text-inverted"
    >
      {{ t('pz.home.challengeTitle') }}
    </h2>
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
          :to="localePath(`${pzRoutes.challenge}/novi`)"
          :label="t('challenge.makeChallenge')"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          class="bg-transparent text-inverted ring-current hover:bg-transparent hover:underline"
          data-testid="challenge-make-link"
        />
      </div>
    </template>
  </section>
</template>
