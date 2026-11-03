<script setup lang="ts">
import type { ContributionKind, ContributionMode } from '~~/shared/utils/contribution'

// "Predloži ispravak" / "Predloži novi zapis": the suggestion form in a modal, opened in place on the
// page it was started from. Follows VariantDialog: a fresh form per opening, focus on the first field,
// Escape closes an open list before the dialog. The form itself is HeritageSuggestForm.
defineProps<{
  kind: ContributionKind
  mode: ContributionMode
  target?: { id: string, label: string, revision?: number }
  current?: Record<string, string | undefined>
  prefill?: Record<string, string | undefined>
}>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const form = useTemplateRef<{ focusFirst: () => void }>('form')

const content = {
  onOpenAutoFocus: (event: Event) => {
    event.preventDefault()
    nextTick(() => form.value?.focusFirst())
  },
  onEscapeKeyDown: (event: KeyboardEvent) => {
    if (document.activeElement?.getAttribute('aria-expanded') === 'true') event.preventDefault()
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t(`heritage.suggest.title.${mode}`)"
    :description="t('heritage.suggest.description')"
    :content="content"
    :ui="{ content: 'max-w-xl', body: 'pb-6' }"
  >
    <template #body>
      <HeritageSuggestForm
        ref="form"
        :kind="kind"
        :mode="mode"
        :target="target"
        :current="current"
        :prefill="prefill"
        dialog
        @close="open = false"
      />
    </template>
  </UModal>
</template>
