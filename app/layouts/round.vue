<script setup lang="ts">
useHead({ htmlAttrs: { 'data-site': 'pz-round' } })
</script>

<template>
  <div class="flex min-h-screen flex-col bg-(--pz-bg)">
    <slot />
  </div>
</template>
