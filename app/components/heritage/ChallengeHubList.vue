<script setup lang="ts">
import { challengeListGroup, type StoredChallenge } from '~~/shared/utils/challengeList'

const props = defineProps<{
  items: StoredChallenge[]
  newPlayersFor: (item: StoredChallenge) => number
}>()

const emit = defineEmits<{ remove: [code: string], visible: [code: string] }>()

const { t } = useI18n()

const finishedOpen = ref(false)

const sections = computed(() => {
  const inProgress: StoredChallenge[] = []
  const waiting: StoredChallenge[] = []
  const yours: StoredChallenge[] = []
  const finished: StoredChallenge[] = []
  for (const item of props.items) {
    const group = challengeListGroup(item)
    if (group === 'inProgress') inProgress.push(item)
    else if (group === 'waiting') waiting.push(item)
    else if (group === 'yours') yours.push(item)
    else finished.push(item)
  }
  return { inProgress, waiting, yours, finished }
})

function onVisible(code: string) {
  emit('visible', code)
}
</script>

<template>
  <div
    v-if="items.length"
    class="space-y-8 border-t border-default pt-10"
    data-testid="challenge-hub-list"
  >
    <HeritageChallengeHubGroup
      v-if="sections.inProgress.length"
      :title="t('challenge.groupInProgress')"
      :items="sections.inProgress"
      :new-players-for="newPlayersFor"
      primary-action="continue"
      @remove="emit('remove', $event)"
      @visible="onVisible"
    />
    <HeritageChallengeHubGroup
      v-if="sections.waiting.length"
      :title="t('challenge.groupWaiting')"
      :items="sections.waiting"
      :new-players-for="newPlayersFor"
      primary-action="play"
      @remove="emit('remove', $event)"
      @visible="onVisible"
    />
    <HeritageChallengeHubGroup
      v-if="sections.yours.length"
      :title="t('challenge.groupYours')"
      :items="sections.yours"
      :new-players-for="newPlayersFor"
      primary-action="leaderboard"
      show-new-players
      @remove="emit('remove', $event)"
      @visible="onVisible"
    />
    <section v-if="sections.finished.length">
      <UButton
        color="neutral"
        variant="ghost"
        class="mb-3"
        :trailing-icon="finishedOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        data-testid="challenge-finished-toggle"
        @click="finishedOpen = !finishedOpen"
      >
        {{ t('challenge.groupFinished') }} ({{ sections.finished.length }})
      </UButton>
      <HeritageChallengeHubGroup
        v-if="finishedOpen"
        :items="sections.finished"
        :new-players-for="newPlayersFor"
        primary-action="leaderboard"
        @remove="emit('remove', $event)"
        @visible="onVisible"
      />
    </section>
  </div>
</template>
