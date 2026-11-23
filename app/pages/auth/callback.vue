<script setup lang="ts">
definePageMeta({ layout: 'potkalnicko' })

const route = useRoute()
const localePath = useLocalePath()
const { configured, finishCallback } = useAuthSession()
const callbackErrorMessage = ref<string | null>(null)
const working = ref(true)

function plainCallbackError() {
  const description = String(route.query.error_description ?? route.query.error ?? '').toLowerCase()
  if (description.includes('cancel') || description.includes('denied')) return 'Prijava je otkazana. Možeš pokušati ponovno kad god želiš.'
  return 'Prijava nije dovršena. Možeš se vratiti na stranicu i pokušati ponovno.'
}

onMounted(async () => {
  if (!configured.value) {
    callbackErrorMessage.value = 'Prijava trenutačno nije dostupna.'
    working.value = false
    return
  }

  if (route.query.error || route.query.error_description) {
    callbackErrorMessage.value = plainCallbackError()
    working.value = false
    return
  }

  const code = typeof route.query.code === 'string' ? route.query.code : ''
  if (!code) {
    callbackErrorMessage.value = 'Prijava nije dovršena. Možeš se vratiti na stranicu i pokušati ponovno.'
    working.value = false
    return
  }

  const error = await finishCallback(code)
  if (error) {
    callbackErrorMessage.value = error
    working.value = false
    return
  }

  const next = typeof route.query.next === 'string' && route.query.next.startsWith('/') && !route.query.next.startsWith('//')
    ? route.query.next
    : '/'
  await navigateTo(localePath(next), { replace: true })
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-(--pz-measure) flex-col gap-4 px-4 py-16 lg:py-24">
    <template v-if="working">
      <h1 class="pz-h1 text-highlighted">
        Prijava
      </h1>
      <p class="pz-body text-muted">
        Dovršavamo prijavu. Trenutak, molim.
      </p>
    </template>
    <template v-else>
      <UAlert
        color="warning"
        variant="subtle"
        title="Prijava nije dovršena"
        :description="callbackErrorMessage ?? 'Možeš se vratiti na javne stranice.'"
        icon="i-lucide-circle-alert"
        role="alert"
        data-testid="auth-callback-error"
      />
      <div>
        <UButton
          :to="localePath('/')"
          label="Natrag na početnu"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="outline"
        />
      </div>
    </template>
  </div>
</template>
