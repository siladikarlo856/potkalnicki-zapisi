<script setup lang="ts">
import { ADMIN_INBOX_PATH } from '~/utils/adminNav'

// The phone's navigation (below 768px): Ploča, Zaprimljeno (with the pending badge), Sadržaj (a sheet with every
// resource by group) and Račun. Fixed at the bottom; the layout leaves room for it.
const route = useRoute()
const signOut = useAdminSignOut()
const { pending } = useAdminPending()
const contentOpen = ref(false)
const accountOpen = ref(false)
watch(() => route.path, () => {
  contentOpen.value = false
  accountOpen.value = false
})

const itemClass = 'group flex min-w-0 flex-col items-center justify-center gap-0.5 pz-caption text-muted no-underline aria-[current=page]:font-bold aria-[current=page]:text-default'
const pillClass = 'relative grid h-7.5 w-14 place-items-center rounded-full group-aria-[current=page]:bg-(--pz-primary-soft) group-aria-[current=page]:text-primary'
const onInbox = computed(() => route.path.startsWith(ADMIN_INBOX_PATH))
const onDashboard = computed(() => route.path.replace(/\/+$/, '') === '/admin')
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-40 grid h-[calc(var(--pz-size-bottom-bar)+env(safe-area-inset-bottom))] grid-cols-4 border-t border-default bg-default pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    aria-label="Urednik"
    data-testid="admin-bottom-bar"
  >
    <NuxtLink
      to="/admin"
      :class="itemClass"
      :aria-current="onDashboard ? 'page' : undefined"
    >
      <span :class="pillClass"><UIcon
        name="i-lucide-layout-dashboard"
        class="size-5.5"
        aria-hidden="true"
      /></span>
      <span>Ploča</span>
    </NuxtLink>
    <NuxtLink
      :to="ADMIN_INBOX_PATH"
      :class="itemClass"
      :aria-current="onInbox ? 'page' : undefined"
    >
      <span :class="pillClass">
        <UIcon
          name="i-lucide-inbox"
          class="size-5.5"
          aria-hidden="true"
        />
        <PzBadge
          :count="pending"
          :noun="PENDING_NOUN"
          variant="attn"
          class="absolute top-0 right-1 h-4.5 min-w-4.5 px-1 text-[0.6875rem]"
          data-testid="admin-pending-phone"
        />
      </span>
      <span>Zaprimljeno</span>
    </NuxtLink>
    <button
      type="button"
      :class="itemClass"
      aria-haspopup="dialog"
      @click="contentOpen = true"
    >
      <span :class="pillClass"><UIcon
        name="i-lucide-library-big"
        class="size-5.5"
        aria-hidden="true"
      /></span>
      <span>Sadržaj</span>
    </button>
    <button
      type="button"
      :class="itemClass"
      aria-haspopup="dialog"
      @click="accountOpen = true"
    >
      <span :class="pillClass"><UIcon
        name="i-lucide-circle-user-round"
        class="size-5.5"
        aria-hidden="true"
      /></span>
      <span>Račun</span>
    </button>
  </nav>

  <AppSheet
    v-model:open="contentOpen"
    title="Sadržaj"
  >
    <AdminNavList :groups="['Sadržaj', 'Igra i učenje', 'Šifrarnici i građa']" />
  </AppSheet>
  <AppSheet
    v-model:open="accountOpen"
    title="Račun"
  >
    <div class="flex flex-col gap-3">
      <UButton
        to="/"
        target="_blank"
        color="neutral"
        variant="outline"
        icon="i-lucide-external-link"
        label="Pogledaj na stranici"
        block
      />
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-muted">Tema</span>
        <UColorModeButton />
      </div>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-log-out"
        label="Odjava"
        block
        @click="signOut"
      />
    </div>
  </AppSheet>
</template>
