<script setup lang="ts">
// Shares how the round went (score and a square per question), never the words or answers.
const props = defineProps<{ results: boolean[] }>()
const { t } = useI18n()
const localePath = useLocalePath()
const origin = ref('')
const expanded = ref(false)
const score = computed(() => props.results.filter(Boolean).length)
const summary = computed(() => resultShareText(t('quiz.shareText', { score: score.value, total: props.results.length }), props.results))
const link = computed(() => origin.value + localePath('/potkalnicko-prigorje/igre/kviz'))

const labels = computed(() => ({
  copy: t('quiz.copyResult'),
  copied: t('quiz.copied'),
  nativeShare: t('quiz.nativeShare'),
  copyError: t('quiz.copyError'),
  shareError: t('quiz.shareError')
}))

onMounted(() => {
  origin.value = window.location.origin
})
</script>

<template>
  <div
    class="flex w-full min-w-0 flex-col items-center gap-2 border-t border-default pt-3 print:hidden"
    data-testid="quiz-share"
  >
    <UButton
      :label="t('quiz.shareTitle')"
      color="neutral"
      variant="link"
      size="sm"
      class="font-medium"
      data-testid="quiz-share-toggle"
      @click="expanded = !expanded"
    />
    <template v-if="expanded">
      <p
        class="w-full rounded-lg bg-elevated p-2 text-sm wrap-anywhere whitespace-pre-line"
        data-testid="quiz-share-text"
      >
        {{ summary }}
      </p>
      <HeritageShareButtons
        prefix="quiz"
        centered
        emphasis="share"
        :copy-text="`${summary}\n${link}`"
        :share-data="{ title: t('quiz.shareTitle'), text: summary, url: link }"
        :labels="labels"
      />
    </template>
  </div>
</template>
