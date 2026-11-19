<script setup lang="ts">
// The "Provjera" cell of a table: the real stamp for the three states the design has. "Neprovjereno" has no stamp
// (it is the absence of one), so it reads as plain muted text.
const props = defineProps<{ value?: string | null }>()
const STATE = { in_review: 'pend', verified: 'ok', needs_update: 'warn' } as const
const state = computed(() => STATE[props.value as keyof typeof STATE])
</script>

<template>
  <PzVerificationStamp
    v-if="state"
    :state="state"
  />
  <span
    v-else
    class="text-muted"
  >{{ value === 'unverified' ? 'Neprovjereno' : '—' }}</span>
</template>
