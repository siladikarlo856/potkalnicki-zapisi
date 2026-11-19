<script setup lang="ts">
// A song or rhyme: dialect on one side, standard Croatian line for line on the other (one column on phone, two from
// 768px). Line breaks are real newlines, so screen readers pause as a reader would. Same number of lines on both
// sides; never centred or reflowed.
withDefaults(defineProps<{
  dialect: string
  rendering: string
  dialectLabel?: string
  renderingLabel?: string
}>(), { dialectLabel: 'Kako se pjeva', renderingLabel: 'Na standardnom jeziku' })
</script>

<template>
  <div
    class="grid gap-4 md:grid-cols-2 md:gap-8"
    data-testid="pz-verse"
  >
    <div>
      <p class="pz-overline mb-1 text-muted">
        {{ dialectLabel }}
      </p>
      <p
        class="pz-reading font-bold whitespace-pre-line italic"
        lang="hr"
        data-testid="verse-dialect"
      >
        {{ dialect }}
      </p>
    </div>
    <div>
      <p class="pz-overline mb-1 text-muted">
        {{ renderingLabel }}
      </p>
      <p
        class="pz-reading whitespace-pre-line text-muted"
        data-testid="verse-rendering"
      >
        {{ rendering }}
      </p>
    </div>
  </div>
</template>
