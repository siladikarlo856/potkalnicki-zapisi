<script setup lang="ts">
// Shares how the round went (score and a square per question), never the words or answers.
const props = defineProps<{ results: boolean[] }>()
const { t } = useI18n()
const localePath = useLocalePath()
const origin = ref('')
const copied = ref(false)
const error = ref('')
const nativeShare = ref(false)
const score = computed(() => props.results.filter(Boolean).length)
const summary = computed(() => resultShareText(t('quiz.shareText', { score: score.value, total: props.results.length }), props.results))
const link = computed(() => origin.value + localePath('/heritage/kviz'))

async function copy() {
  error.value = ''
  try {
    await navigator.clipboard.writeText(`${summary.value}\n${link.value}`)
    copied.value = true
  } catch {
    error.value = t('quiz.copyError')
  }
}

async function share() {
  error.value = ''
  try {
    await navigator.share({ title: t('quiz.shareTitle'), text: summary.value, url: link.value })
  } catch (cause) {
    if (!(cause instanceof Error && cause.name === 'AbortError')) error.value = t('quiz.shareError')
  }
}

// A new result is a new message: forget that the previous one was copied.
watch(summary, () => {
  copied.value = false
})

onMounted(() => {
  origin.value = window.location.origin
  nativeShare.value = typeof navigator.share === 'function'
})
</script>

<template>
  <div
    class="flex w-full min-w-0 flex-col gap-2 border-t border-default pt-3 print:hidden"
    data-testid="quiz-share"
  >
    <h3 class="text-sm font-semibold text-highlighted">
      {{ t('quiz.shareTitle') }}
    </h3>
    <p
      class="rounded-lg bg-elevated p-2 text-sm wrap-anywhere whitespace-pre-line"
      data-testid="quiz-share-text"
    >
      {{ summary }}
    </p>
    <div class="flex flex-wrap justify-center gap-2">
      <UButton
        icon="i-lucide-copy"
        color="neutral"
        variant="outline"
        data-testid="quiz-copy"
        @click="copy"
      >
        {{ t(copied ? 'quiz.copied' : 'quiz.copyResult') }}
      </UButton>
      <UButton
        v-if="nativeShare"
        icon="i-lucide-share-2"
        data-testid="quiz-native-share"
        @click="share"
      >
        {{ t('quiz.nativeShare') }}
      </UButton>
    </div>
    <p
      v-if="copied"
      role="status"
      class="sr-only"
    >
      {{ t('quiz.copied') }}
    </p>
    <p
      v-if="error"
      role="alert"
      class="text-sm text-error"
    >
      {{ error }}
    </p>
  </div>
</template>
