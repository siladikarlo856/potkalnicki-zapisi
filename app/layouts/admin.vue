<script setup lang="ts">
useThemeColor('#F8FAFC', '#1E293B')
useHead({
  titleTemplate: title => title ? `${title} · Administracija` : 'Administracija',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }]
})

// The inbox badge counts pending submissions; the layout stays usable when the count cannot be read.
const { data: summary } = useFetch<{ pending: number }>('/api/admin/inbox/summary', { server: false, key: 'admin-inbox-summary' })
const nav = computed(() => ADMIN_NAV.map(item => item.to === '/admin/prijedlozi' && summary.value?.pending
  ? { ...item, badge: summary.value.pending }
  : item))

async function signOut() {
  await $fetch('/api/admin/session', { method: 'DELETE' })
  await navigateTo('/admin/prijava')
}
</script>

<template>
  <UDashboardGroup
    unit="rem"
    storage="local"
    storage-key="admin-dashboard"
  >
    <UDashboardSidebar
      collapsible
      resizable
      :ui="{ footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed }">
        <ULink
          to="/admin"
          class="flex items-center gap-2 font-semibold text-highlighted"
        >
          <UIcon
            name="i-lucide-shield-check"
            class="size-5 shrink-0 text-primary"
          />
          <span v-if="!collapsed">Administracija</span>
        </ULink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="nav"
          orientation="vertical"
          tooltip
          aria-label="Administracija"
        />
      </template>

      <template #footer="{ collapsed }">
        <div
          class="flex w-full gap-1"
          :class="collapsed ? 'flex-col items-center' : 'items-center justify-between'"
        >
          <UButton
            :label="collapsed ? undefined : 'Odjava'"
            icon="i-lucide-log-out"
            color="neutral"
            variant="ghost"
            aria-label="Odjava"
            @click="signOut"
          />
          <UColorModeButton />
        </div>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
