<script setup lang="ts">
// The sidebar of the admin shell. 240px with labels from 1024px, a 56px icon rail from 768px, and the choice to collapse
// the wide one to the rail (remembered). Below 768px there is no sidebar: the bottom bar takes over.
const signOut = useAdminSignOut()
const desktop = useMedia('(min-width: 1024px)')
const collapsed = ref(false)
const KEY = 'admin-sidebar-collapsed'

onMounted(() => {
  try {
    collapsed.value = localStorage.getItem(KEY) === '1'
  } catch { /* storage unavailable: stays expanded */ }
})
function toggle() {
  collapsed.value = !collapsed.value
  try {
    localStorage.setItem(KEY, collapsed.value ? '1' : '0')
  } catch { /* the choice just is not remembered */ }
}
// The tooltips matter only while the labels are hidden.
const rail = computed(() => collapsed.value || !desktop.value)
</script>

<template>
  <aside
    class="group/side hidden shrink-0 flex-col border-e border-default bg-default md:flex md:w-14 lg:w-60 lg:data-[sidebar=collapsed]:w-14"
    data-testid="admin-sidebar"
    :data-sidebar="collapsed ? 'collapsed' : 'expanded'"
  >
    <div class="flex h-14 shrink-0 items-center gap-2 border-b border-default px-4 max-lg:justify-center max-lg:px-0 group-data-[sidebar=collapsed]/side:justify-center group-data-[sidebar=collapsed]/side:px-0">
      <ULink
        to="/admin"
        class="flex min-w-0 items-center gap-2 font-bold text-highlighted no-underline"
        aria-label="Potkalnički zapisi: urednik"
      >
        <UIcon
          name="i-lucide-mountain"
          class="size-6 shrink-0 text-primary"
          aria-hidden="true"
        />
        <span class="truncate max-lg:hidden group-data-[sidebar=collapsed]/side:hidden">Urednik</span>
      </ULink>
    </div>

    <nav
      aria-label="Urednik"
      class="min-h-0 flex-1 overflow-y-auto p-2"
    >
      <AdminNavList :rail="rail" />
    </nav>

    <div class="flex shrink-0 flex-col gap-1 border-t border-default p-2">
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-log-out"
        aria-label="Odjava"
        class="justify-start max-lg:justify-center group-data-[sidebar=collapsed]/side:justify-center"
        @click="signOut"
      >
        <span class="max-lg:hidden group-data-[sidebar=collapsed]/side:hidden">Odjava</span>
      </UButton>
      <UButton
        color="neutral"
        variant="ghost"
        :icon="collapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
        :aria-label="collapsed ? 'Proširi izbornik' : 'Skupi izbornik'"
        class="justify-start max-lg:hidden group-data-[sidebar=collapsed]/side:justify-center"
        data-testid="admin-sidebar-toggle"
        @click="toggle"
      >
        <span class="group-data-[sidebar=collapsed]/side:hidden">Skupi izbornik</span>
      </UButton>
    </div>
  </aside>
</template>
