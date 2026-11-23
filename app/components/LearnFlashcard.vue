<script setup lang="ts">
// Recall practice in a learning session. The back replaces the front in place: no 3D turn, so reduced motion changes
// nothing. The front is one "Pokaži značenje"-style toggle for pointer users (Enter or Space reveals it too); the
// revealed content is announced through a polite live region. Content comes from the caller:
//   front slot: the prompt (the word, the clue); back slot: the answer, its links and corrections.
defineProps<{
  /** The accessible name of the front button, e.g. "Pokaži značenje: obloček". */
  label: string
  /** What a screen reader hears when the card is turned. */
  announce?: string
}>()
const flipped = defineModel<boolean>('flipped', { default: false })

const frontToggle = useTemplateRef<HTMLButtonElement>('frontToggle')
const back = useTemplateRef<HTMLElement>('back')
watch(flipped, async (value) => {
  await nextTick()
  if (value) back.value?.focus({ preventScroll: true })
  else frontToggle.value?.focus({ preventScroll: true })
})
defineExpose({ focus: () => (flipped.value ? back.value : frontToggle.value)?.focus() })
</script>

<template>
  <div
    class="relative flex min-h-70 flex-col items-center justify-center gap-3 rounded-(--pz-radius-lg) px-4 py-6 text-center"
    :class="flipped ? 'border border-transparent bg-elevated' : 'border border-default bg-default'"
    :data-flipped="flipped"
    data-testid="learn-card"
    lang="hr"
  >
    <p
      class="sr-only"
      aria-live="polite"
    >
      <template v-if="flipped">
        {{ announce }}
      </template>
    </p>
    <template v-if="!flipped">
      <button
        ref="frontToggle"
        type="button"
        class="absolute inset-0 cursor-pointer rounded-(--pz-radius-lg)"
        :aria-label="label"
        data-testid="learn-card-front"
        @click="flipped = true"
      />
      <slot name="front" />
    </template>
    <div
      v-else
      ref="back"
      tabindex="-1"
      class="flex w-full flex-col items-center gap-3 outline-none"
      data-testid="learn-card-back"
    >
      <slot name="back" />
    </div>
  </div>
</template>
