<script setup lang="ts">
definePageMeta({ layout: 'admin-auth', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })

useSeoMeta({ title: 'Nema pristupa', robots: 'noindex, nofollow' })
const localePath = useLocalePath()
const { user } = useAuthSession()
const signOut = useAdminSignOut()
</script>

<template>
  <div class="mx-auto flex w-full max-w-[400px] flex-col px-4 py-10 sm:py-20">
    <UCard>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <p class="text-sm text-muted">
            Potkalnički zapisi · urednik
          </p>
          <h1 class="text-xl font-bold text-highlighted">
            Nema pristupa uređivanju
          </h1>
        </div>
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-lock"
          title="Račun nema uredničku ulogu"
          :description="user?.email
            ? `Prijava na ${user.email} ne otvara administraciju. Ako trebaš pristup, javi administratoru.`
            : 'Tvoj račun ne otvara administraciju. Ako trebaš pristup, javi administratoru.'"
          data-testid="admin-no-access-alert"
        />
        <div class="flex flex-col gap-2 sm:flex-row">
          <UButton
            :to="localePath('/')"
            variant="outline"
            color="neutral"
            class="justify-center"
          >
            Na početnu
          </UButton>
          <UButton
            v-if="user"
            variant="ghost"
            color="neutral"
            class="justify-center"
            data-testid="admin-no-access-sign-out"
            @click="signOut()"
          >
            Odjavi se
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
