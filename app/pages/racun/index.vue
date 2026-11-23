<script setup lang="ts">
import { pzRoutes } from '~~/shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const localePath = useLocalePath()
const { user, role, configured } = useAuthSession()
useSeoMeta({ title: 'Postavke računa' })
</script>

<template>
  <div class="mx-auto flex w-full max-w-(--pz-measure) flex-col gap-6 px-4 py-8 lg:py-12">
    <header class="flex flex-col gap-2">
      <p class="pz-overline text-muted">
        Račun
      </p>
      <h1 class="pz-h1 text-highlighted">
        Postavke računa
      </h1>
      <p class="pz-lead text-muted">
        Ovdje ćeš moći upravljati računom i glavnim mjestom.
      </p>
    </header>

    <UAlert
      v-if="!configured"
      color="neutral"
      variant="subtle"
      title="Računi trenutačno nisu dostupni"
      description="Javne stranice možeš koristiti bez računa."
      icon="i-lucide-circle-info"
      data-testid="account-settings-unconfigured"
    />
    <UCard v-else-if="user">
      <template #header>
        <h2 class="font-bold text-highlighted">
          Tvoj račun
        </h2>
      </template>
      <dl class="flex flex-col gap-3 pz-body">
        <div>
          <dt class="font-bold">
            E-mail
          </dt>
          <dd class="text-muted">
            {{ user.email ?? 'Nije dostupan' }}
          </dd>
        </div>
        <div>
          <dt class="font-bold">
            Uloga
          </dt>
          <dd class="text-muted">
            {{ role ?? 'Nedostupna' }}
          </dd>
        </div>
      </dl>
      <template #footer>
        <NuxtLink
          :to="localePath('/racun/glavno-mjesto/')"
          class="pz-body-sm text-muted underline"
          data-testid="account-settings-main-place"
        >Glavno mjesto</NuxtLink>
      </template>
    </UCard>
    <UAlert
      v-else
      color="neutral"
      variant="subtle"
      title="Nisi prijavljen/a"
      description="Prijavi se iz javnog zaglavlja za pristup postavkama računa."
      icon="i-lucide-circle-user-round"
      data-testid="account-settings-signed-out"
    />

    <NuxtLink
      :to="localePath(pzRoutes.home)"
      class="pz-body-sm text-muted underline"
    >Natrag na početnu</NuxtLink>
  </div>
</template>
