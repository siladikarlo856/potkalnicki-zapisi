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

const challengeTo = computed(() => localePath(`${pzRoutes.challenge}/${props.item.code}`))

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
  <UCard
    variant="outline"
    data-testid="challenge-resume-card"
  >
    <div class="space-y-3">
      <h2 class="text-lg font-semibold text-highlighted">
        {{ t('challenge.resumeTitle') }}
      </h2>
      <p class="text-sm text-muted">
        {{ subtitle }}
      </p>
      <UButton
        :to="challengeTo"
        :label="t('challenge.resumeContinue')"
        trailing-icon="i-lucide-arrow-right"
        size="lg"
        data-testid="challenge-resume-continue"
      />
    </div>
  </UCard>
</template>
