<script setup lang="ts">
// The right end of the top bar on every admin screen: command search, "Pogledaj na stranici", theme and the account menu.
// On a phone the bar keeps the search button and the theme; the rest is in the bottom bar's "Račun" sheet.
const signOut = useAdminSignOut()
const searchOpen = ref(false)
const accountItems = [[{ label: 'Odjava', icon: 'i-lucide-log-out', onSelect: signOut }]]
</script>

<template>
  <div class="flex items-center gap-1">
    <UButton
      color="neutral"
      variant="outline"
      icon="i-lucide-search"
      class="hidden md:inline-flex"
      data-testid="admin-command-open"
      @click="searchOpen = true"
    >
      Traži ili skoči na…
      <UKbd
        value="meta"
        size="sm"
      />
      <UKbd
        value="k"
        size="sm"
      />
    </UButton>
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-search"
      aria-label="Traži ili skoči na…"
      class="md:hidden"
      @click="searchOpen = true"
    />
    <UButton
      to="/"
      target="_blank"
      color="neutral"
      variant="ghost"
      icon="i-lucide-external-link"
      label="Pogledaj na stranici"
      class="hidden lg:inline-flex"
    />
    <UColorModeButton />
    <UDropdownMenu
      :items="accountItems"
      :content="{ align: 'end' }"
    >
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-circle-user-round"
        aria-label="Račun"
        class="hidden md:inline-flex"
      />
    </UDropdownMenu>
    <AdminCommandSearch v-model:open="searchOpen" />
  </div>
</template>
