<script setup lang="ts">
import type { ChallengeState, QuizChallengeInput } from '../../../shared/utils/challenge'

const props = defineProps<{ code?: string, quiz?: QuizChallengeInput, score?: number, total?: number }>()
const { t } = useI18n()
const localePath = useLocalePath()
const origin = ref('')
const createdCode = ref(props.code ?? '')
const error = ref('')
const nickname = ref('')
const creating = ref(false)
const link = computed(() => createdCode.value ? origin.value + localePath(`/potkalnicko-prigorje/izazov/${createdCode.value}`) : '')
const shareText = computed(() => `${t('challenge.shareMessage')} ${link.value}`)
const shareLabels = computed(() => ({
  copy: t('challenge.copy'),
  copied: t('challenge.copied'),
  nativeShare: t('challenge.nativeShare'),
  copyError: t('challenge.copyError'),
  shareError: t('challenge.shareError'),
  whatsapp: t('challenge.whatsapp'),
  viber: t('challenge.viber')
}))

async function create() {
  const name = challengeNickname(nickname.value)
  if (!name) {
    error.value = t('challenge.invalidNickname')
    return
  }
  if (!props.quiz || creating.value) return
  creating.value = true
  error.value = ''
  try {
    const state = await $fetch<ChallengeState>('/api/challenges', {
      method: 'POST',
      body: { nickname: name, quiz: props.quiz }
    })
    createdCode.value = state.code
  } catch (cause) {
    const failure = cause as { status?: number, statusCode?: number }
    error.value = (failure.status ?? failure.statusCode) === 429 ? t('challenge.limited') : t('challenge.createError')
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  origin.value = window.location.origin
})
</script>

<template>
  <UCard
    v-if="quiz && !createdCode"
    data-testid="challenge-create"
  >
    <form
      class="space-y-4"
      @submit.prevent="create"
    >
      <div>
        <h2 class="text-xl font-semibold">
          {{ t('challenge.friendTitle') }}
        </h2>
        <p class="mt-2 text-sm text-muted">
          {{ t('challenge.friendHelp') }}
        </p>
      </div>
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
        icon="i-lucide-swords"
        :loading="creating"
        size="lg"
        block
      >
        {{ props.score != null && props.total != null
          ? t('challenge.friendCreateWithScore', { score: props.score, total: props.total })
          : t('challenge.friendCreate') }}
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
  <UCard
    v-else-if="createdCode"
    data-testid="challenge-share"
  >
    <div class="space-y-4">
      <h2 class="text-xl font-semibold">
        {{ t('challenge.share') }}
      </h2>
      <p class="text-sm text-muted">
        {{ t('challenge.shareHelp') }}
      </p>
      <UFormField :label="t('challenge.link')">
        <UInput
          :model-value="link"
          readonly
          class="w-full"
          data-testid="challenge-share-link"
          @focus="($event.target as HTMLInputElement).select()"
        />
      </UFormField>
      <HeritageShareButtons
        prefix="challenge"
        :disabled="!origin"
        :copy-text="link"
        :share-data="{ title: t('challenge.title'), url: link }"
        :message-text="shareText"
        :labels="shareLabels"
      />
    </div>
  </UCard>
</template>
