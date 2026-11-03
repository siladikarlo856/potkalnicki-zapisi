<script setup lang="ts">
import type { AtlasItemStatus } from '~~/shared/types/atlas'
import { heritageVerificationLabelKey } from '~~/shared/utils/heritageVerification'

const props = defineProps<{
  verification?: AtlasItemStatus
  label?: string
}>()

const { t } = useI18n()

const text = computed(() => {
  if (props.label) return props.label
  if (props.verification) return t(heritageVerificationLabelKey(props.verification))
  return 'U provjeri'
})

const testId = computed(() => props.verification === 'unverified' || !props.verification
  ? 'heritage-status-unverified'
  : `heritage-status-${props.verification}`)
</script>

<template>
  <UBadge
    color="warning"
    variant="subtle"
    class="gap-1"
    :data-testid="testId"
  >
    <UIcon
      name="i-lucide-shield-alert"
      class="size-3.5 shrink-0"
    />
    <span>{{ text }}</span>
  </UBadge>
</template>
