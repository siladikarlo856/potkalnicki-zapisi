<script setup lang="ts">
import type { AtlasItemStatus } from '~~/shared/types/atlas'
import { trustVerificationState } from '~~/shared/utils/heritageVerification'

// Potvrda: whether it was really told or practised here, in this form. For Stories, Customs and Folk texts the
// verification confirms the attestation and never the truth of what is told, so the words say exactly that.
const props = defineProps<{
  verification?: AtlasItemStatus
}>()

const { t } = useI18n()
const state = computed(() => trustVerificationState(props.verification))

const VARIANTS = {
  unverified: { icon: 'i-lucide-shield-question', label: 'pz.intangible.attestation.unverified', help: 'pz.intangible.attestation.helpUnverified', classes: 'text-muted border-accented bg-default' },
  verified: { icon: 'i-lucide-shield-check', label: 'pz.intangible.attestation.verified', help: 'pz.intangible.attestation.helpVerified', classes: 'text-success border-success bg-(--pz-success-soft)' },
  needs_update: { icon: 'i-lucide-shield-alert', label: 'pz.intangible.attestation.needsUpdate', help: 'pz.intangible.attestation.helpNeedsUpdate', classes: 'text-warning border-warning bg-(--pz-warning-soft)' }
} as const

const variant = computed(() => VARIANTS[state.value])
</script>

<template>
  <div
    class="flex flex-col gap-1"
    :data-testid="`attestation-${state}`"
  >
    <div>
      <span
        class="inline-flex min-h-7 items-center gap-1.5 rounded-full border py-[3px] pr-3 pl-2 text-[13px]/[18px] font-semibold"
        :class="variant.classes"
      >
        <UIcon
          :name="variant.icon"
          class="size-4 shrink-0"
          aria-hidden="true"
        />
        <span>{{ t(variant.label) }}</span>
      </span>
    </div>
    <p class="pz-caption font-normal text-muted">
      {{ t(variant.help) }}
    </p>
  </div>
</template>
