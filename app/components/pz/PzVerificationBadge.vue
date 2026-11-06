<script setup lang="ts">
import type { AtlasItemStatus } from '~~/shared/types/atlas'
import { trustVerificationState } from '~~/shared/utils/heritageVerification'

// Provjera: how well the facts are confirmed. A status-coloured pill with a shield.
// Never confuse with PzProtectionTag (square, landmark, always neutral ink).
const props = defineProps<{
  verification?: AtlasItemStatus
}>()

const { t } = useI18n()

const state = computed(() => trustVerificationState(props.verification))

const VARIANTS = {
  unverified: {
    icon: 'i-lucide-shield-question',
    labelKey: 'pz.trust.verification.unverified',
    classes: 'text-muted border-accented bg-default'
  },
  verified: {
    icon: 'i-lucide-shield-check',
    labelKey: 'pz.trust.verification.verified',
    classes: 'text-success border-success bg-(--pz-success-soft)'
  },
  needs_update: {
    icon: 'i-lucide-shield-alert',
    labelKey: 'pz.trust.verification.needsUpdate',
    classes: 'text-warning border-warning bg-(--pz-warning-soft)'
  }
} as const

const variant = computed(() => VARIANTS[state.value])
</script>

<template>
  <span
    class="inline-flex min-h-7 items-center gap-1.5 rounded-full border py-[3px] pr-3 pl-2 text-[13px]/[18px] font-semibold"
    :class="variant.classes"
    :data-testid="`verification-badge-${state}`"
    :data-state="state"
  >
    <UIcon
      :name="variant.icon"
      class="size-4 shrink-0"
      aria-hidden="true"
    />
    <span>{{ t(variant.labelKey) }}</span>
  </span>
</template>
