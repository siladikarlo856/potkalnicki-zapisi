<script setup lang="ts">
import { pzRoutes } from '~~/shared/utils/appRoutes'

// The end of a contribution on /doprinesi: a teal "Hvala!", what happens next, and two ways back into the archive.
const emit = defineEmits<{ again: [] }>()
const { t } = useI18n()
const localePath = useLocalePath()
const closeButton = useTemplateRef<{ $el: HTMLElement }>('again')

defineExpose({ focus: () => closeButton.value?.$el?.focus() })
</script>

<template>
  <div
    class="flex flex-col gap-4"
    data-testid="pz-submission-success"
  >
    <UAlert
      :title="t('pz.contribute.successTitle')"
      :description="t('pz.contribute.successDescription')"
      icon="i-lucide-circle-check"
      color="success"
      variant="subtle"
      role="status"
    />
    <section class="flex flex-col gap-1">
      <h2 class="pz-label text-highlighted">
        {{ t('pz.contribute.nextTitle') }}
      </h2>
      <p class="pz-body text-muted">
        {{ t('pz.contribute.nextBody') }}
      </p>
    </section>
    <div class="flex flex-wrap gap-2">
      <UButton
        :to="localePath(pzRoutes.explore)"
        :label="t('pz.contribute.linkExplore')"
        icon="i-lucide-compass"
        color="neutral"
        variant="outline"
        class="ring-(--ui-border-accented)"
      />
      <UButton
        :to="localePath(pzRoutes.games)"
        :label="t('pz.contribute.linkPlay')"
        icon="i-lucide-gamepad-2"
        color="neutral"
        variant="outline"
        class="ring-(--ui-border-accented)"
      />
      <UButton
        ref="again"
        :label="t('pz.contribute.sendAnother')"
        color="neutral"
        variant="ghost"
        @click="emit('again')"
      />
    </div>
  </div>
</template>
