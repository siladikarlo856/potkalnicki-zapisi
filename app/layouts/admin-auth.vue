<script setup lang="ts">
// The sign-in page: no shell, since nothing in the admin works before signing in. One centred card on the page ground.
useThemeColor('#F3F4EE', '#0F1512')
useHead({
  titleTemplate: title => title ? `${title} · Administracija` : 'Administracija',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }]
})
</script>

<template>
  <div class="min-h-dvh bg-muted">
    <div class="flex justify-end p-4">
      <UColorModeButton />
    </div>
    <UMain
      id="main-content"
      tabindex="-1"
      class="focus:outline-none"
    >
      <slot />
    </UMain>
  </div>
</template>
