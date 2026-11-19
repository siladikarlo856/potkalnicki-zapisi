<script setup lang="ts">
import type { ChallengeState } from '~~/shared/utils/challenge'
import { pzRoutes } from '~~/shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
useSeoMeta({ title: () => t('challenge.hubPageTitle'), description: () => t('challenge.hubPageIntro') })

const code = ref('')
const codeError = ref('')
const codeBusy = ref(false)
const { items, forget, refreshItem, resetRefreshBudget, newPlayersFor } = useChallengeList()
const refreshed = ref(new Set<string>())

async function onRowVisible(challengeCode: string) {
  if (refreshed.value.has(challengeCode)) return
  refreshed.value.add(challengeCode)
  const item = items.value.find(entry => entry.code === challengeCode)
  await refreshItem(challengeCode, { fetchLeaderboard: item?.role === 'creator' })
}

async function join() {
  const normalized = code.value.trim().replace(/\s+/g, '')
  if (!normalized) {
    codeError.value = t('challenge.codeRequired')
    return
  }
  if (codeBusy.value) return
  codeBusy.value = true
  codeError.value = ''
  try {
    await $fetch<ChallengeState>(`/api/challenges/${encodeURIComponent(normalized)}`)
    await navigateTo(localePath(pzPath(pzRoutes.challenge, normalized)))
  } catch (cause) {
    const failure = cause as { status?: number, statusCode?: number }
    codeError.value = (failure.status ?? failure.statusCode) === 404
      ? t('challenge.codeNotFound')
      : t('challenge.error')
  } finally {
    codeBusy.value = false
  }
}

onMounted(resetRefreshBudget)
</script>

<template>
  <UContainer class="max-w-3xl py-6 sm:py-10">
    <header class="flex flex-col gap-3">
      <p class="pz-overline text-muted">
        {{ t('pz.challenge.introOverline') }}
      </p>
      <h1 class="pz-h1 text-highlighted">
        {{ t('challenge.hubPageTitle') }}
      </h1>
      <p class="pz-lead text-muted">
        {{ t('challenge.hubPageIntro') }}
      </p>
    </header>

    <div class="mt-6 space-y-4">
      <UButton
        :to="localePath(pzRoutes.challengeNew)"
        icon="i-lucide-swords"
        size="xl"
        block
        data-testid="challenge-hub-new"
      >
        {{ t('challenge.newChallenge') }}
      </UButton>

      <UCard
        class="mt-5"
        :ui="{ body: 'space-y-4' }"
        aria-labelledby="challenge-code-title"
      >
        <div>
          <h2
            id="challenge-code-title"
            class="pz-h3 text-highlighted"
          >
            {{ t('challenge.haveCode') }}
          </h2>
        </div>
        <PzChallengeCodeField
          v-model="code"
          :busy="codeBusy"
          :error="codeError"
          :label="t('challenge.codeLabel')"
          :hint="t('challenge.codeHint')"
          @submit="join"
        />
      </UCard>
    </div>

    <div class="mt-8">
      <HeritageChallengeHubList
        :items="items"
        :new-players-for="newPlayersFor"
        @remove="forget"
        @visible="onRowVisible"
      />
      <div
        v-if="!items.length"
        class="mt-8 flex flex-col items-center gap-3 rounded-(--pz-radius-lg) border border-default p-6 text-center"
        data-testid="challenge-empty"
      >
        <span class="grid size-14 place-items-center rounded-full bg-accented text-primary">
          <UIcon name="i-lucide-swords" />
        </span>
        <h2 class="pz-h3 text-highlighted">
          {{ t('challenge.noChallenges') }}
        </h2>
        <p class="text-muted">
          {{ t('challenge.noChallengesHelp') }}
        </p>
      </div>
    </div>
  </UContainer>
</template>
