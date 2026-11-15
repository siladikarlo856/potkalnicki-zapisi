<script setup lang="ts">
import type { ChallengeState } from '~~/shared/utils/challenge'
import { DEFAULT_GENERATE } from '~~/shared/utils/challenge'
import { pzRoutes } from '~~/shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({ title: () => t('challenge.hubTitle'), description: () => t('challenge.hubIntro') })

const quickOpen = ref(false)
const nickname = ref('')
const busy = ref(false)
const error = ref('')
const { remember, items, forget, refreshItem, resetRefreshBudget, newPlayersFor } = useChallengeList()
const refreshed = ref(new Set<string>())

async function onRowVisible(code: string) {
  if (refreshed.value.has(code)) return
  refreshed.value.add(code)
  const item = items.value.find(entry => entry.code === code)
  await refreshItem(code, { fetchLeaderboard: item?.role === 'creator' })
}

onMounted(() => {
  resetRefreshBudget()
})

async function quickChallenge() {
  const name = challengeNickname(nickname.value)
  if (!name) {
    error.value = t('challenge.invalidNickname')
    return
  }
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const state = await $fetch<ChallengeState>('/api/challenges', {
      method: 'POST',
      body: { nickname: name, generate: DEFAULT_GENERATE }
    })
    remember(state, 'creator')
    await navigateTo(localePath(`/izazov/${state.code}`))
  } catch (cause) {
    const failure = cause as { status?: number, statusCode?: number }
    error.value = (failure.status ?? failure.statusCode) === 429 ? t('challenge.limited') : t('challenge.createError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <UContainer class="max-w-3xl space-y-8 py-6 sm:py-10">
      <UButton
        :to="localePath(pzRoutes.home)"
        color="neutral"
        variant="link"
        icon="i-lucide-arrow-left"
      >
        {{ t('challenge.heritage') }}
      </UButton>

      <header class="relative flex flex-col gap-3 py-2">
        <PzRidge class="absolute -top-2 right-0 h-28 w-3/4 opacity-80" />
        <p class="pz-overline relative text-muted">
          {{ t('pz.challenge.introOverline') }}
        </p>
        <h1 class="pz-display relative text-highlighted">
          {{ t('challenge.hubTitle') }}
        </h1>
        <p class="pz-lead relative text-muted">
          {{ t('challenge.hubIntro') }}
        </p>
      </header>

      <ol class="pz-body list-decimal space-y-2 pl-5 text-muted">
        <li>{{ t('challenge.hubStep1') }}</li>
        <li>{{ t('challenge.hubStep2') }}</li>
        <li>{{ t('challenge.hubStep3') }}</li>
      </ol>

      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <UButton
          :to="localePath(`${pzRoutes.challenge}/novi`)"
          size="lg"
          icon="i-lucide-wand-sparkles"
          data-testid="challenge-hub-custom"
        >
          {{ t('challenge.createPageTitle') }}
        </UButton>
        <UButton
          v-if="!quickOpen"
          size="lg"
          color="neutral"
          variant="outline"
          icon="i-lucide-zap"
          data-testid="challenge-hub-quick"
          @click="quickOpen = true"
        >
          {{ t('challenge.quickCreate') }}
        </UButton>
      </div>

      <UCard
        v-if="quickOpen"
        data-testid="challenge-quick-form"
      >
        <form
          class="space-y-4"
          @submit.prevent="quickChallenge"
        >
          <p class="text-sm text-muted">
            {{ t('challenge.quickCreateHelp') }}
          </p>
          <UFormField
            :label="t('challenge.nickname')"
            :help="t('challenge.nicknameHelp')"
            required
          >
            <UInput
              v-model="nickname"
              name="nickname"
              autocomplete="nickname"
              :maxlength="24"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            :loading="busy"
          >
            {{ t('challenge.quickCreateSubmit') }}
          </UButton>
          <p
            v-if="error"
            role="alert"
            class="text-sm text-error"
          >
            {{ error }}
          </p>
        </form>
      </UCard>
    </UContainer>

    <UContainer class="max-w-3xl pb-16">
      <HeritageChallengeHubList
        :items="items"
        :new-players-for="newPlayersFor"
        @remove="forget"
        @visible="onRowVisible"
      />
    </UContainer>
  </div>
</template>
