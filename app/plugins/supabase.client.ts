import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export default defineNuxtPlugin(() => {
  const { public: publicConfig } = useRuntimeConfig()
  const url = publicConfig.supabase?.url
  const anonKey = publicConfig.supabase?.anonKey

  if (!url || !anonKey) {
    useState<SupabaseClient | null>('pz-supabase-client', () => null).value = null
    return
  }

  const client = createClient(url, anonKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  })
  useState<SupabaseClient | null>('pz-supabase-client', () => client).value = client
})
