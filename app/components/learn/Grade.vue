<script setup lang="ts">
// "Ne znam" and "Znam": the self-grade after the card is turned. In the sticky action bar on mobile (the primary,
// Znam, on the right), under the card on desktop. "Ne znam" is not a failure: the card returns later in the session.
const emit = defineEmits<{ score: [knew: boolean] }>()
const { t } = useI18n()
</script>

<template>
  <div
    class="hidden grid-cols-2 gap-3 lg:grid print:hidden"
    data-testid="learn-grade-desktop"
  >
    <UButton
      :label="t('pz.learn.unknown')"
      icon="i-lucide-rotate-ccw"
      color="neutral"
      variant="outline"
      size="xl"
      block
      data-testid="learn-unknown-desktop"
      @click="emit('score', false)"
    />
    <UButton
      :label="t('pz.learn.known')"
      icon="i-lucide-check"
      size="xl"
      block
      data-testid="learn-known-desktop"
      @click="emit('score', true)"
    />
  </div>
  <PzStickyActionBar class="-mx-4 sm:-mx-6">
    <UButton
      :label="t('pz.learn.unknown')"
      icon="i-lucide-rotate-ccw"
      color="neutral"
      variant="outline"
      size="xl"
      block
      data-testid="learn-unknown"
      @click="emit('score', false)"
    />
    <UButton
      :label="t('pz.learn.known')"
      icon="i-lucide-check"
      size="xl"
      block
      data-testid="learn-known"
      @click="emit('score', true)"
    />
  </PzStickyActionBar>
</template>
