<script setup lang="ts">
import type { ChallengeMeta, ChallengeState, QuizChallengeInput } from '../../../shared/utils/challenge'
import { challengeInviteShareText } from '~/utils/shareResult'

const props = defineProps<{
  code?: string
  /** The challenge title, shown on the link preview. */
  title?: string
  quiz?: QuizChallengeInput
  score?: number
  total?: number
  invite?: {
    nickname: string
    questionCount: number
    closesAt: string
    meta?: ChallengeMeta | null
    targetScore?: number | null
  }
}>()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const { pool } = useCardPool()
const origin = ref('')
const createdCode = ref(props.code ?? '')
const error = ref('')
const nickname = ref('')
const creating = ref(false)
const { remember } = useChallengeList()
const link = computed(() => createdCode.value ? origin.value + localePath(`/potkalnicko-prigorje/izazov/${createdCode.value}`) : '')
const shareText = computed(() => {
  if (props.invite && link.value) {
    return challengeInviteShareText({
      nickname: props.invite.nickname,
      url: link.value,
      questionCount: props.invite.questionCount,
      closesAt: props.invite.closesAt,
      meta: props.invite.meta,
      pool: pool.value,
      lang: locale.value === 'en' ? 'en' : 'hr',
      targetScore: props.invite.targetScore
    })
  }
  return `${t('challenge.shareMessage')} ${link.value}`
})
const date = computed(() => props.invite?.closesAt
  ? new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'hr-HR', { dateStyle: 'long' }).format(new Date(props.invite.closesAt))
  : '')
const previewTitle = computed(() => {
  const title = props.title ?? t('challenge.title')
  return props.invite?.nickname ? t('pz.share.previewTitle', { nickname: props.invite.nickname, title }) : t('pz.share.previewTitleOpen', { title })
})
const host = computed(() => origin.value ? new URL(origin.value).host : '')

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
    remember(state, 'creator')
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
        <h2 class="pz-h2 text-highlighted">
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
  <section
    v-else-if="createdCode"
    class="flex min-w-0 flex-col gap-4"
    aria-labelledby="challenge-share-title"
    data-testid="challenge-share"
  >
    <div class="flex flex-col gap-2">
      <p class="pz-overline text-muted">
        {{ t('pz.challenge.inviteOverline') }}
      </p>
      <h2
        id="challenge-share-title"
        class="pz-h1 text-highlighted"
      >
        {{ t('pz.share.challengeTitle') }}
      </h2>
      <p class="pz-body text-muted">
        {{ date ? t('pz.share.challengeContext', { date }) : t('pz.share.challengeContextPlain') }}
      </p>
    </div>
    <PzLinkPreview
      :title="previewTitle"
      :caption="`${title ?? t('challenge.title')} · ${t('pz.share.brand')}`"
      :host="host"
    />
    <PzShareActions
      prefix="challenge"
      :disabled="!origin"
      :message="shareText"
      :url="link"
      :share-data="{ title: t('challenge.title'), url: link }"
    />
  </section>
</template>
