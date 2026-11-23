<script setup lang="ts">
const route = useRoute()
const localePath = useLocalePath()
const { user, role, configured, loading, error, signIn, signOut } = useAuthSession()

const accountItems = computed(() => {
  if (!user.value) return []
  return [
    [{ label: user.value.email ?? 'Prijavljen račun', icon: 'i-lucide-circle-user-round', disabled: true }],
    [
      { label: 'Glavno mjesto', icon: 'i-lucide-map-pin', to: localePath('/racun/glavno-mjesto/') },
      { label: 'Postavke računa', icon: 'i-lucide-settings', to: localePath('/racun/') }
    ],
    [{ label: 'Odjava', icon: 'i-lucide-log-out', onSelect: signOut }]
  ]
})

async function startSignIn() {
  await signIn(route.fullPath)
}
</script>

<template>
  <div class="relative flex items-center">
    <UDropdownMenu
      v-if="user"
      :items="accountItems"
      :content="{ align: 'end' }"
      data-testid="account-menu"
    >
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-circle-user-round"
        aria-label="Račun"
        class="min-h-(--pz-tap-min)"
        :loading="loading"
      >
        <span class="hidden max-w-40 truncate sm:inline">{{ user.email }}</span>
      </UButton>
    </UDropdownMenu>
    <UButton
      v-else-if="configured"
      color="neutral"
      variant="outline"
      icon="i-simple-icons-google"
      :loading="loading"
      label="Prijava"
      data-testid="account-sign-in"
      @click="startSignIn"
    />
    <UButton
      v-else
      color="neutral"
      variant="ghost"
      icon="i-lucide-circle-user-round"
      label="Prijava nedostupna"
      disabled
      data-testid="account-sign-in-disabled"
      :title="'Prijava trenutačno nije dostupna.'"
    />
    <span
      v-if="error"
      class="absolute end-0 top-full z-10 mt-1 w-64 rounded-md bg-default p-2 text-xs text-error shadow-lg"
      role="alert"
      data-testid="account-auth-error"
    >{{ error }}</span>
    <span class="sr-only">Uloga: {{ role ?? (user ? 'nedostupna' : 'neprijavljen') }}</span>
  </div>
</template>
