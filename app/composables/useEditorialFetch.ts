import type { SupabaseClient } from '@supabase/supabase-js'
import { BROWSER_EDITORIAL_AUTH_HEADER } from '#shared/utils/editorialAuth'

export function useEditorialFetch() {
  if (import.meta.server) return useRequestFetch()
  const client = useState<SupabaseClient | null>('pz-supabase-client', () => null)
  return $fetch.create({
    async onRequest({ options }) {
      options.headers.set(BROWSER_EDITORIAL_AUTH_HEADER, '1')
      options.headers.delete('authorization')
      if (!client.value) return
      const passwordSession = await $fetch<{ authenticated: boolean }>('/api/admin/session', {
        headers: { [BROWSER_EDITORIAL_AUTH_HEADER]: '1' },
        retry: 0
      }).catch(() => null)
      if (passwordSession?.authenticated !== false) return
      const result = await client.value?.auth.getSession().catch(() => null)
      const token = result?.error ? undefined : result?.data.session?.access_token
      if (token) options.headers.set('authorization', `Bearer ${token}`)
    }
  })
}
