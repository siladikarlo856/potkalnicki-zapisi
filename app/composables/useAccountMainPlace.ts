import type { MainPlacePreference } from '~~/server/utils/accountMainPlace'

export function useAccountMainPlace() {
  const { session } = useAuthSession()
  const preference = useState<MainPlacePreference | null>('pz-account-main-place', () => null)
  const loading = useState('pz-account-main-place-loading', () => false)
  const error = useState<string | null>('pz-account-main-place-error', () => null)

  async function authorizedFetch<T>(init: { method?: 'GET' | 'PUT', body?: unknown } = {}) {
    const token = session.value?.access_token
    if (!token) throw new Error('missing-session')
    return $fetch<T>('/api/account/main-place', {
      method: init.method ?? 'GET',
      ...(init.body !== undefined ? { body: init.body as Record<string, string | null> } : {}),
      headers: { Authorization: `Bearer ${token}` },
      retry: 0
    })
  }

  async function refresh() {
    if (!session.value?.access_token) {
      preference.value = null
      error.value = null
      return null
    }
    loading.value = true
    error.value = null
    try {
      preference.value = await authorizedFetch<MainPlacePreference>()
      return preference.value
    } catch {
      error.value = 'Glavno mjesto nismo uspjeli učitati. Pokušaj ponovno.'
      return null
    } finally {
      loading.value = false
    }
  }

  async function save(mainPlaceId: string | null) {
    if (!session.value?.access_token) return false
    loading.value = true
    error.value = null
    try {
      preference.value = await authorizedFetch<MainPlacePreference>({ method: 'PUT', body: { mainPlaceId } })
      return true
    } catch (cause) {
      const message = (cause as { statusMessage?: string }).statusMessage
      error.value = message && message.length < 200
        ? message
        : 'Spremanje glavnog mjesta nije uspjelo. Pokušaj ponovno.'
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    preference,
    loading,
    error,
    refresh,
    save
  }
}
