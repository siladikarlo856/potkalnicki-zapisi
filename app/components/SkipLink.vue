<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <!-- Plain anchor: the browser moves focus to the <main> target, not just the scroll position. -->
  <a
    href="#main-content"
    class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-md focus:bg-inverted focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-inverted focus:outline-2 focus:outline-offset-2 focus:outline-primary"
  >
    {{ t('a11y.skipToContent') }}
  </a>
</template>
