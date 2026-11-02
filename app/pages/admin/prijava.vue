<script setup lang="ts">
definePageMeta({ layout: 'admin-auth' })
defineI18nRoute({ locales: ['hr'] })

useSeoMeta({ title: 'Prijava', robots: 'noindex, nofollow' })
const route = useRoute()
const password = ref('')
const loading = ref(false)
const error = ref('')

async function signIn() {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/admin/session', { method: 'POST', body: { password: password.value } })
    const requested = typeof route.query.next === 'string' ? route.query.next : '/admin'
    const next = requested.startsWith('/admin') && !requested.startsWith('/admin/prijava') ? requested : '/admin'
    await navigateTo(next)
  } catch (cause) {
    const status = (cause as { statusCode?: number }).statusCode
    error.value = status === 429
      ? 'Previše pogrešnih pokušaja. Pokušaj ponovno za 15 minuta.'
      : status === 503
        ? 'Administracija nije postavljena na serveru.'
        : 'Lozinka nije točna.'
  } finally {
    password.value = ''
    loading.value = false
  }
}
</script>

<template>
  <UContainer class="py-16 sm:py-24">
    <UCard class="mx-auto max-w-md">
      <template #header>
        <div class="space-y-2">
          <h1 class="text-3xl font-bold text-highlighted">
            Prijava
          </h1>
          <p class="text-muted">
            Prijavi se za upravljanje sadržajem.
          </p>
        </div>
      </template>
      <UAlert
        v-if="error"
        :title="error"
        color="error"
        variant="subtle"
        role="alert"
        class="mb-4"
      />
      <form
        class="space-y-4"
        @submit.prevent="signIn"
      >
        <UFormField label="Lozinka">
          <UInput
            v-model="password"
            type="password"
            autocomplete="current-password"
            autofocus
            required
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          label="Prijavi se"
          block
          :loading="loading"
        />
      </form>
    </UCard>
  </UContainer>
</template>
