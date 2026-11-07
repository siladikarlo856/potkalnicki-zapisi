<script setup lang="ts">
// A row of small × marks, after the cross-stitch of local folk embroidery: a section rule on the home page
// and on the Riječ dana plate. One row, at most 240px wide, in the ochre (or wheat on an inverted slab).
// Decorative.
</script>

<template>
  <svg
    viewBox="0 0 160 10"
    preserveAspectRatio="xMidYMid meet"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    aria-hidden="true"
    focusable="false"
    data-testid="pz-stitch"
    class="pointer-events-none block h-2.5 w-40 max-w-60 text-warning"
  >
    <path
      v-for="x in 10"
      :key="x"
      :d="`M${(x - 1) * 16 + 1} 1 l8 8 M${(x - 1) * 16 + 9} 1 l-8 8`"
    />
  </svg>
</template>
