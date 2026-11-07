<script setup lang="ts">
// Zaštita: the item's legal heritage status. A square-cornered tag with an inner rule and a
// landmark, always neutral ink. Never confuse with PzVerificationBadge (pill, shield, coloured).
const props = defineProps<{
  status?: 'protected' | 'unknown'
  register?: string
}>()

const { t } = useI18n()

const kind = computed<'protected' | 'preventive' | 'unknown'>(() => {
  if (props.status !== 'protected') return 'unknown'
  return props.register?.trim().toUpperCase().startsWith('P-') ? 'preventive' : 'protected'
})

const label = computed(() => t(`pz.trust.protection.${kind.value}`))
const register = computed(() => kind.value === 'unknown' ? undefined : props.register?.trim() || undefined)
</script>

<template>
  <span
    class="inline-flex min-h-7 items-center gap-1.5 rounded-(--pz-radius-sm) border bg-default py-[3px] pr-2.5 pl-2 text-[13px]/[18px] font-medium shadow-[inset_0_0_0_2px_var(--ui-bg),inset_0_0_0_3px_var(--ui-border)]"
    :class="kind === 'unknown' ? 'border-accented text-muted' : 'border-(--ui-text-muted) text-default'"
    :data-testid="`protection-tag-${kind}`"
    :data-state="kind"
  >
    <UIcon
      name="i-lucide-landmark"
      class="size-4 shrink-0"
      aria-hidden="true"
    />
    <span>{{ label }}</span>
    <span
      v-if="register"
      class="text-dimmed"
    >{{ ' ' + register }}</span>
  </span>
</template>
