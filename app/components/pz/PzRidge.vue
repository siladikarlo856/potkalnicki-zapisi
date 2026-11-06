<script setup lang="ts">
// The Kalnik line from the logo, repeated as four offset contour lines. Decorative: it sits behind heroes and
// empty states, never behind text that must be read. Stroke is currentColor, so a utility such as
// text-(--ui-border) on paper or text-primary on an inverted slab inks it; it stretches to its box.
</script>

<template>
  <svg
    viewBox="0 0 400 120"
    preserveAspectRatio="none"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
    stroke-linecap="round"
    aria-hidden="true"
    focusable="false"
    data-testid="pz-ridge"
    class="pointer-events-none block text-(--ui-border)"
  >
    <path
      vector-effect="non-scaling-stroke"
      d="M0 112 L80 82 L128 94 L220 42 L344 106 L400 108"
    />
    <path
      vector-effect="non-scaling-stroke"
      d="M0 92 L80 65.6 L128 76.2 L220 30.4 L344 86.7 L400 88.5"
    />
    <path
      vector-effect="non-scaling-stroke"
      d="M0 72 L80 49.2 L128 58.6 L220 18.8 L344 67.4 L400 68.9"
    />
    <path
      vector-effect="non-scaling-stroke"
      d="M0 52 L80 32.8 L128 40.6 L220 7.2 L344 48.1 L400 49.4"
    />
  </svg>
</template>
