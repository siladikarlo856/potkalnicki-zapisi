<script setup lang="ts">
// The login page: no sidebar, since nothing in it works before signing in.
useThemeColor('#F8FAFC', '#1E293B')
useHead({
  titleTemplate: title => title ? `${title} · Administracija` : 'Administracija',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }]
})
</script>

<template>
  <div class="min-h-screen bg-default">
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
