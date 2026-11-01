<script setup lang="ts">
import type { ChallengeState, QuizChallengeInput } from '../../../shared/utils/challenge'

const props = defineProps<{ code?: string, quiz?: QuizChallengeInput, score?: number, total?: number }>()
const { t } = useI18n()
const localePath = useLocalePath()
const origin = ref('')
const createdCode = ref(props.code ?? '')
const copied = ref(false)
const error = ref('')
const nativeShare = ref(false)
const nickname = ref('')
const creating = ref(false)
const link = computed(() => createdCode.value ? origin.value + localePath(`/potkalnicko-prigorje/izazov/${createdCode.value}`) : '')
const shareText = computed(() => `${t('challenge.shareMessage')} ${link.value}`)
const whatsapp = computed(() => `https://wa.me/?text=${encodeURIComponent(shareText.value)}`)
const viber = computed(() => `viber://forward?text=${encodeURIComponent(shareText.value)}`)

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

async function copy() {
  error.value = ''
  try {
    await navigator.clipboard.writeText(link.value)
    copied.value = true
  } catch {
    error.value = t('challenge.copyError')
  }
}

async function share() {
  error.value = ''
  try {
    await navigator.share({ title: t('challenge.title'), url: link.value })
  } catch (cause) {
    if (!(cause instanceof Error && cause.name === 'AbortError')) error.value = t('challenge.shareError')
  }
}

onMounted(() => {
  origin.value = window.location.origin
  nativeShare.value = typeof navigator.share === 'function'
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
      <div class="flex flex-wrap gap-3">
        <UButton
          icon="i-lucide-copy"
          :disabled="!origin"
          data-testid="challenge-copy"
          @click="copy"
        >
          {{ t(copied ? 'challenge.copied' : 'challenge.copy') }}
        </UButton>
        <UButton
          v-if="nativeShare"
          color="neutral"
          variant="outline"
          icon="i-lucide-share-2"
          data-testid="challenge-native-share"
          @click="share"
        >
          {{ t('challenge.nativeShare') }}
        </UButton>
        <UButton
          :to="whatsapp"
          target="_blank"
          external
          color="neutral"
          variant="outline"
          icon="i-simple-icons-whatsapp"
          data-testid="challenge-whatsapp"
        >
          {{ t('challenge.whatsapp') }}
        </UButton>
        <UButton
          :to="viber"
          external
          color="neutral"
          variant="outline"
          icon="i-simple-icons-viber"
          data-testid="challenge-viber"
        >
          {{ t('challenge.viber') }}
        </UButton>
      </div>
      <p
        v-if="copied"
        role="status"
        class="sr-only"
      >
        {{ t('challenge.copied') }}
      </p>
      <p
        v-if="error"
        role="alert"
        class="text-sm text-error"
      >
        {{ error }}
      </p>
    </div>
  </UCard>
</template>
