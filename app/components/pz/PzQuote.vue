<script setup lang="ts">
// A narrator's words in the dialect, with the same sentence in standard Croatian below and the attribution in
// the footer. Keep both lines together and never correct the dialect. The attribution follows the narrator's
// consent level: full form, initials, or "kazivanje, Kalnik, 2025."
defineProps<{
  /** The sentence as spoken; shown in „ ” quotation marks. */
  dialect: string
  /** The same sentence in standard Croatian: a faithful rendering, not an explanation. */
  rendering?: string
  /** "kazivačica Marija K., Kalnik, zabilježeno 2025." */
  attribution?: string
}>()
</script>

<template>
  <blockquote
    class="m-0 border-l-4 border-(--pz-accent) py-1 pl-4 text-lg/[1.5] lg:text-xl/[1.5]"
    data-testid="pz-quote"
  >
    <p lang="hr">
      <i>„{{ dialect }}”</i>
    </p>
    <p
      v-if="rendering"
      class="mt-1 text-sm text-muted"
    >
      {{ rendering }}
    </p>
    <footer
      v-if="attribution"
      class="mt-2 text-sm text-muted"
    >
      {{ attribution }}
    </footer>
  </blockquote>
</template>
