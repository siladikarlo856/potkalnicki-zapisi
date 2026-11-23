<script setup lang="ts">
import { pzRoutes } from '~~/shared/utils/appRoutes'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const localePath = useLocalePath()
const { user, configured } = useAuthSession()
const { preference, loading, error, refresh, save } = useAccountMainPlace()

const placeId = ref<string | null>(null)
const placeQuery = ref('')
const placeSaving = ref(false)
const savedMessage = ref<string | null>(null)

useSeoMeta({ title: 'Glavno mjesto' })

async function loadPreference() {
  savedMessage.value = null
  const next = await refresh()
  if (!next) {
    placeId.value = null
    placeQuery.value = ''
    return
  }
  placeId.value = next.place?.id ?? null
  placeQuery.value = next.place?.name ?? ''
}

onMounted(() => {
  if (user.value) void loadPreference()
})

watch(user, (next) => {
  if (next) void loadPreference()
  else {
    placeId.value = null
    placeQuery.value = ''
  }
})

async function onSave() {
  if (!placeId.value) return
  placeSaving.value = true
  savedMessage.value = null
  const ok = await save(placeId.value)
  placeSaving.value = false
  if (ok) savedMessage.value = 'Glavno mjesto je spremljeno.'
}

async function onClear() {
  placeSaving.value = true
  savedMessage.value = null
  const ok = await save(null)
  placeId.value = null
  placeQuery.value = ''
  placeSaving.value = false
  if (ok) savedMessage.value = 'Glavno mjesto je uklonjeno.'
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-(--pz-measure) flex-col gap-6 px-4 py-8 lg:py-12">
    <header class="flex flex-col gap-2">
      <p class="pz-overline text-muted">
        Račun
      </p>
      <h1 class="pz-h1 text-highlighted">
        Glavno mjesto
      </h1>
      <p class="pz-lead text-muted">
        Objavljeno naselje koje želiš koristiti kao zadano mjesto za učenje na stranici Uči. Sprema se uz tvoj račun i dostupno je na drugim uređajima dok si prijavljen/a.
      </p>
    </header>

    <UAlert
      v-if="!configured"
      color="neutral"
      variant="subtle"
      title="Računi trenutačno nisu dostupni"
      description="Javne stranice možeš koristiti bez računa."
      icon="i-lucide-circle-info"
      data-testid="main-place-unconfigured"
    />
    <UAlert
      v-else-if="!user"
      color="neutral"
      variant="subtle"
      title="Nisi prijavljen/a"
      description="Prijavi se iz javnog zaglavlja da bi postavio/la glavno mjesto."
      icon="i-lucide-circle-user-round"
      data-testid="main-place-signed-out"
    />
    <UCard
      v-else
      data-testid="main-place-settings"
    >
      <template #header>
        <h2 class="font-bold text-highlighted">
          Tvoje glavno mjesto
        </h2>
      </template>
      <div class="flex flex-col gap-4 pz-body">
        <UAlert
          v-if="preference?.archivedNote"
          color="neutral"
          variant="subtle"
          :title="preference.archivedNote"
          icon="i-lucide-info"
          data-testid="main-place-archived-note"
        />
        <HeritagePlacePicker
          v-model="placeId"
          v-model:query="placeQuery"
        />
        <p
          v-if="error"
          class="text-error"
          role="alert"
          data-testid="main-place-error"
        >
          {{ error }}
        </p>
        <p
          v-else-if="savedMessage"
          class="text-muted"
          role="status"
          data-testid="main-place-saved"
        >
          {{ savedMessage }}
        </p>
      </div>
      <template #footer>
        <div class="flex flex-wrap gap-2">
          <UButton
            label="Spremi"
            color="neutral"
            :loading="loading || placeSaving"
            :disabled="!placeId"
            data-testid="main-place-save"
            @click="onSave"
          />
          <UButton
            v-if="preference?.place || preference?.mainPlaceId"
            label="Ukloni"
            color="neutral"
            variant="outline"
            :loading="loading || placeSaving"
            data-testid="main-place-clear"
            @click="onClear"
          />
        </div>
      </template>
    </UCard>

    <NuxtLink
      :to="localePath('/racun/')"
      class="pz-body-sm text-muted underline"
    >Natrag na postavke računa</NuxtLink>
    <NuxtLink
      :to="localePath(pzRoutes.home)"
      class="pz-body-sm text-muted underline"
    >Natrag na početnu</NuxtLink>
  </div>
</template>
