<script setup lang="ts">
import { daysUntilClose } from '~~/shared/utils/challengeList'
import type { StoredChallenge } from '~~/shared/utils/challengeList'
import { pzRoutes } from '~~/shared/utils/appRoutes'

const props = defineProps<{
  item: StoredChallenge
  /** Shown when the challenge is closed instead of the countdown. */
  closedLabel?: string
}>()

const { t } = useI18n()
const localePath = useLocalePath()

const challengeTo = computed(() => localePath(pzPath(pzRoutes.challenge, props.item.code)))

const daysLeft = computed(() => daysUntilClose(props.item.closesAt))

const questionLine = computed(() => {
  const last = props.item.last
  if (!last?.questionCount) return props.item.title
  const current = Math.min(last.index + 1, last.questionCount)
  return t('challenge.resumeQuestionLine', {
    title: props.item.title,
    current,
    total: last.questionCount
  })
})

const closeLine = computed(() => {
  const last = props.item.last
  if (last?.closed) return props.closedLabel ?? t('challenge.resumeClosed')
  if (daysLeft.value <= 0) return t('challenge.resumeClosesToday')
  return t('challenge.resumeClosesIn', { n: daysLeft.value })
})

const subtitle = computed(() => `${questionLine.value} · ${closeLine.value}`)
</script>

<template>
  <div
    class="relative flex flex-col gap-3"
    data-testid="challenge-resume-card"
  >
    <h3 class="pz-label text-inverted">
      {{ t('challenge.resumeTitle') }}
    </h3>
    <p class="pz-body-sm text-inverted">
      {{ subtitle }}
    </p>
    <UButton
      :to="challengeTo"
      :label="t('challenge.resumeContinue')"
      trailing-icon="i-lucide-arrow-right"
      size="lg"
      color="neutral"
      block
      class="bg-(--pz-wheat) text-default hover:bg-(--pz-wheat) hover:brightness-95"
      data-testid="challenge-resume-continue"
    />
  </div>
</template>
