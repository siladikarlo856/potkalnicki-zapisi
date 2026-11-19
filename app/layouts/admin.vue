<script setup lang="ts">
// The admin shell (21-admin-screens.md "Shell"): a sidebar from 768px (full from 1024px, an icon rail between), a bottom
// bar below that, the pending badge in all of them and a sign-in dialog that can appear over any editor.
useThemeColor('#F3F4EE', '#0F1512')
useHead({
  htmlAttrs: { 'data-admin': '' },
  titleTemplate: title => title ? `${title} · Administracija` : 'Administracija',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }]
})
</script>

<template>
  <div>
    <UDashboardGroup
      unit="rem"
      class="max-md:bottom-[calc(var(--pz-size-bottom-bar)+env(safe-area-inset-bottom))]"
    >
      <AdminSidebar />
      <slot />
    </UDashboardGroup>
    <AdminBottomBar />
    <AdminSessionExpiredDialog />
  </div>
</template>
