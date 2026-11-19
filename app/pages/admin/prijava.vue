<script setup lang="ts">
definePageMeta({ layout: 'admin-auth' })
defineI18nRoute({ locales: ['hr'] })

useSeoMeta({ title: 'Prijava', robots: 'noindex, nofollow' })
const localePath = useLocalePath()
const route = useRoute()
const online = useOnlineState()

// The sign-in is the server's single password (`POST /api/admin/session`); the page restyles it and adds no method.
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const fieldError = ref('')
type Failure = 'wrong' | 'locked' | 'unconfigured' | 'unreachable'
const failure = ref<Failure | null>(null)
const alertRef = useTemplateRef<HTMLElement>('alert')

// Arriving after the session ended mid-work (`?razlog=istekla`, set where a 401 was seen).
const expired = computed(() => route.query.razlog === 'istekla' && !failure.value)

async function signIn() {
  failure.value = null
  fieldError.value = ''
  if (!password.value) {
    fieldError.value = 'Upiši lozinku.'
    return
  }
  loading.value = true
  try {
    await $fetch('/api/admin/session', { method: 'POST', body: { password: password.value } })
    const requested = typeof route.query.next === 'string' ? route.query.next : '/admin'
    const next = requested.startsWith('/admin') && !requested.startsWith('/admin/prijava') ? requested : '/admin'
    await navigateTo(next)
  } catch (cause) {
    const status = (cause as { statusCode?: number }).statusCode
    failure.value = status === 429 ? 'locked' : status === 503 ? 'unconfigured' : status ? 'wrong' : 'unreachable'
    await nextTick()
    alertRef.value?.focus()
  } finally {
    password.value = ''
    loading.value = false
  }
}

const COPY: Record<Failure, { title: string, description: string, icon: string, color: 'error' | 'warning' }> = {
  wrong: { title: 'Prijava nije uspjela', description: 'Lozinka nije točna. Pokušaj ponovno.', icon: 'i-lucide-circle-alert', color: 'error' },
  locked: { title: 'Previše pokušaja', description: 'Radi sigurnosti prijava je zaustavljena na 15 minuta.', icon: 'i-lucide-hourglass', color: 'warning' },
  unconfigured: { title: 'Administracija nije postavljena', description: 'Administracija nije postavljena na serveru.', icon: 'i-lucide-circle-alert', color: 'error' },
  unreachable: { title: 'Nema veze', description: 'Za prijavu treba veza s internetom.', icon: 'i-lucide-wifi-off', color: 'warning' }
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-[400px] flex-col px-4 py-10 sm:py-20">
    <form
      class="flex flex-col gap-5 rounded-lg bg-default p-5 ring-1 ring-default sm:p-6"
      novalidate
      data-testid="admin-login"
      @submit.prevent="signIn"
    >
      <div class="flex items-center gap-3">
        <svg
          viewBox="0 0 36 36"
          width="36"
          height="36"
          aria-hidden="true"
          class="shrink-0"
        >
          <rect
            width="36"
            height="36"
            rx="10"
            fill="var(--ui-primary)"
          />
          <path
            d="M6 23.5 12 15l3 4 4-8.5 4 7.5 3-3 4 8.5"
            fill="none"
            stroke="var(--ui-text-inverted)"
            stroke-width="2.2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        </svg>
        <span class="pz-overline text-muted">Potkalnički zapisi · urednik</span>
      </div>
      <h1 class="pz-h2 text-highlighted">
        Prijava
      </h1>

      <div
        ref="alert"
        tabindex="-1"
        class="focus:outline-none"
        data-testid="admin-login-message"
      >
        <UAlert
          v-if="!online"
          color="warning"
          variant="subtle"
          icon="i-lucide-wifi-off"
          title="Nema veze"
          description="Za prijavu treba veza s internetom."
          role="status"
        />
        <UAlert
          v-else-if="failure"
          :color="COPY[failure].color"
          variant="subtle"
          :icon="COPY[failure].icon"
          :title="COPY[failure].title"
          :description="COPY[failure].description"
          role="alert"
        />
        <UAlert
          v-else-if="expired"
          color="neutral"
          variant="subtle"
          icon="i-lucide-clock"
          title="Sesija je istekla"
          description="Prijavi se ponovno. Vratit ćemo te na stranicu na kojoj je rad stao."
          role="status"
        />
      </div>

      <UFormField
        label="Lozinka"
        name="password"
        :error="fieldError || undefined"
      >
        <UInput
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          autofocus
          class="w-full"
          :ui="{ trailing: 'pe-1' }"
          data-testid="admin-login-password"
        >
          <template #trailing>
            <UButton
              color="neutral"
              variant="link"
              size="sm"
              :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              :aria-label="showPassword ? 'Sakrij lozinku' : 'Prikaži lozinku'"
              :aria-pressed="showPassword"
              @click="showPassword = !showPassword"
            />
          </template>
        </UInput>
      </UFormField>

      <UButton
        type="submit"
        block
        :loading="loading"
        :disabled="!online"
        :aria-busy="loading"
      >
        {{ loading ? 'Prijavljujem…' : 'Prijavi se' }}
      </UButton>

      <p class="pz-caption text-muted">
        Urednički dio nije javan. Tražiš arhiv? <NuxtLink
          :to="localePath('/')"
          class="text-primary underline underline-offset-2"
        >
          Na početnu
        </NuxtLink>
      </p>
    </form>
  </div>
</template>
