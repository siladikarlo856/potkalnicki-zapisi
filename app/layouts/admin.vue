<script setup lang="ts">
useThemeColor('#F8FAFC', '#1E293B')
useHead({
  titleTemplate: title => title ? `${title} · Administracija` : 'Administracija',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }]
})

async function signOut() {
  await $fetch('/api/admin/session', { method: 'DELETE' })
  await navigateTo('/admin/prijava')
}
</script>

<template>
  <div class="min-h-screen bg-default">
    <UHeader
      to="/admin"
      title="Administracija"
    >
      <template #right>
        <UButton
          label="Odjava"
          icon="i-lucide-log-out"
          color="neutral"
          variant="ghost"
          @click="signOut"
        />
        <UColorModeButton />
      </template>
    </UHeader>
    <UMain
      id="main-content"
      tabindex="-1"
      class="focus:outline-none"
    >
      <slot />
    </UMain>
  </div>
</template>
