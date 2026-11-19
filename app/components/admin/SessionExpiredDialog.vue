<script setup lang="ts">
// The session ended while an editor was open: the password is asked for over the form, which keeps everything typed.
// After a successful sign-in the editor runs the save it had queued. (The sign-in is the existing password; there is no
// e-mail to prefill.)
const { expired, signIn } = useAdminSessionState()
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  if (!password.value) {
    error.value = 'Upiši lozinku.'
    return
  }
  loading.value = true
  try {
    await signIn(password.value)
    password.value = ''
  } catch (cause) {
    const status = (cause as { statusCode?: number }).statusCode
    error.value = status === 429 ? 'Previše pogrešnih pokušaja. Pokušaj ponovno za 15 minuta.' : status ? 'Lozinka nije točna. Pokušaj ponovno.' : 'Nema veze. Za prijavu treba veza s internetom.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    :open="expired"
    title="Prijavi se ponovno"
    description="Sesija je istekla zbog neaktivnosti. Sve što je upisano ostalo je u obrascu i spremit će se čim se prijaviš."
    :dismissible="false"
    :close="false"
    data-testid="admin-session-expired"
  >
    <template #body>
      <form
        id="admin-session-form"
        class="flex flex-col gap-4"
        novalidate
        @submit.prevent="submit"
      >
        <UFormField
          label="Lozinka"
          name="password"
          :error="error || undefined"
        >
          <UInput
            v-model="password"
            type="password"
            autocomplete="current-password"
            autofocus
            class="w-full"
            data-testid="admin-session-password"
          />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <UButton
        type="submit"
        form="admin-session-form"
        label="Prijavi se i nastavi"
        :loading="loading"
        class="ms-auto"
      />
    </template>
  </UModal>
</template>
