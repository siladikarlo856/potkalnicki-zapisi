<script setup lang="ts">
// The clues of the word of the day, one at a time: "Trag 1 od 3", the newest marked "novo". The list is a polite
// live region, so a newly revealed clue is announced.
defineProps<{ hints: readonly { text: string }[], total: number }>()
</script>

<template>
  <div
    class="flex flex-col gap-2"
    aria-live="polite"
    data-testid="hint-list"
  >
    <div
      v-for="(hint, index) in hints"
      :key="index"
      class="flex items-start gap-2.5 rounded-(--pz-radius-md) bg-elevated px-3.5 py-3"
      data-testid="hint"
    >
      <UIcon
        name="i-lucide-lightbulb"
        class="mt-0.5 size-5 shrink-0"
        aria-hidden="true"
      />
      <p>
        <b class="pz-overline block text-muted">Trag {{ index + 1 }} od {{ total }}<template v-if="index === hints.length - 1 && hints.length > 1"> · novo</template></b>
        <span lang="hr">{{ hint.text }}</span>
      </p>
    </div>
  </div>
</template>
