import type { Session, User } from '@supabase/supabase-js'
import type { AccountRole } from '~~/shared/types/accounts'
import { syncEditorialSessionCookie } from '~/utils/editorialSession'

const SESSION_KEY = 'pz-auth-session'
const ROLE_KEY = 'pz-auth-account-role'
const INITIALIZED_KEY = 'pz-auth-session-initialized'
const INITIALIZING_KEY = 'pz-auth-session-initializing'
const ERROR_KEY = 'pz-auth-session-error'
const EDITORIAL_SYNC_ERROR = 'Urednička sesija nije usklađena. Pokušaj ponovno.'

function publicUser(user: User | null) {
  return user ? { id: user.id, email: user.email ?? null } : null
}

function callbackError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('cancel') || message.includes('denied')) return 'Prijava je otkazana. Možeš pokušati ponovno kad god želiš.'
  return 'Prijava nije dovršena. Provjeri postavke prijave pa pokušaj ponovno.'
}

async function syncAccountRole(accessToken: string): Promise<AccountRole | 'refused' | null> {
  try {
    const { role } = await $fetch<{ role: AccountRole }>('/api/account/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    return role
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    if (status === 403) return 'refused'
    return null
  }
}

export function useAuthSession() {
  const client = useState<import('@supabase/supabase-js').SupabaseClient | null>('pz-supabase-client', () => null)
  const session = useState<Session | null>(SESSION_KEY, () => null)
  const accountRole = useState<AccountRole | null>(ROLE_KEY, () => null)
  const initialized = useState(INITIALIZED_KEY, () => false)
  const initializing = useState(INITIALIZING_KEY, () => false)
  const error = useState<string | null>(ERROR_KEY, () => null)

  const configured = computed(() => Boolean(client.value))
  const user = computed(() => publicUser(session.value?.user ?? null))
  const role = computed<AccountRole | null>(() => (session.value ? accountRole.value : null))
  const loading = computed(() => initializing.value)

  function replaceSession(nextSession: Session | null) {
    if (!nextSession || session.value?.user.id !== nextSession.user.id) accountRole.value = null
    session.value = nextSession
    return syncEditorialCookie(nextSession)
  }

  function isCurrentSession(activeSession: Session | null) {
    return session.value?.user.id === activeSession?.user.id
      && session.value?.access_token === activeSession?.access_token
  }

  async function syncEditorialCookie(activeSession: Session | null) {
    try {
      await syncEditorialSessionCookie(client.value)
      return null
    } catch {
      if (isCurrentSession(activeSession)) error.value = EDITORIAL_SYNC_ERROR
      return EDITORIAL_SYNC_ERROR
    }
  }

  async function applyServerSync(activeSession: Session | null) {
    if (!isCurrentSession(activeSession)) return null
    if (!activeSession?.access_token || !client.value) {
      accountRole.value = null
      return null
    }
    const outcome = await syncAccountRole(activeSession.access_token)
    if (!isCurrentSession(activeSession)) return null
    if (outcome === null) {
      error.value = 'Uloga računa trenutačno nije dostupna. Pokušaj ponovno.'
      return error.value
    }
    if (outcome === 'refused') {
      const message = 'Račun nema potvrđenu e-poštu. Prijava nije moguća.'
      void replaceSession(null)
      error.value = message
      await client.value.auth.signOut()
      const cookieError = await syncEditorialCookie(session.value)
      return cookieError ?? message
    }
    accountRole.value = outcome
    error.value = null
    return null
  }

  async function initialize() {
    if (!import.meta.client || !client.value || initialized.value) return
    await callOnce(INITIALIZED_KEY, restoreSession)
  }

  async function restoreSession() {
    const authClient = client.value
    if (!authClient) return
    initializing.value = true
    let authChangeSync: Promise<unknown> | undefined
    try {
      authClient.auth.onAuthStateChange((_event, nextSession) => {
        const hadSession = Boolean(session.value)
        const cookieSync = replaceSession(nextSession)
        if (nextSession) {
          error.value = null
          authChangeSync = Promise.all([cookieSync, applyServerSync(nextSession)]).then(([cookieError]) => {
            if (cookieError && isCurrentSession(nextSession)) error.value = cookieError
          }).catch(() => {
            if (isCurrentSession(nextSession)) error.value = EDITORIAL_SYNC_ERROR
          })
        } else {
          authChangeSync = cookieSync
          if (hadSession) error.value = 'Sesija je istekla. Prijavi se ponovno ako želiš nastaviti.'
        }
      })

      const initialSession = session.value
      const { data, error: sessionError } = await authClient.auth.getSession()
      if (session.value !== initialSession) return
      if (sessionError) {
        void replaceSession(null)
        error.value = 'Sesija je istekla. Prijavi se ponovno ako želiš nastaviti.'
      } else {
        const cookieSync = replaceSession(data.session)
        const [cookieError] = await Promise.all([cookieSync, applyServerSync(data.session)])
        if (cookieError && isCurrentSession(data.session)) error.value = cookieError
      }
    } catch (cause) {
      void replaceSession(null)
      error.value = callbackError(cause)
    } finally {
      while (authChangeSync) {
        const pending = authChangeSync
        await pending
        if (pending === authChangeSync) break
      }
      initialized.value = true
      initializing.value = false
    }
  }

  if (import.meta.client && getCurrentInstance()) onMounted(() => initialize())

  async function signIn(next = '/') {
    if (!client.value) {
      error.value = 'Prijava trenutačno nije dostupna.'
      return false
    }

    error.value = null
    initializing.value = true
    try {
      const redirect = new URL('/auth/callback/', window.location.origin)
      const safeNext = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/auth/callback') ? next : '/'
      redirect.searchParams.set('next', safeNext)
      const { error: signInError } = await client.value.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirect.toString() }
      })
      if (signInError) {
        error.value = callbackError(signInError)
        return false
      }
      return true
    } catch (cause) {
      error.value = callbackError(cause)
      return false
    } finally {
      initializing.value = false
    }
  }

  async function finishCallback(code: string) {
    if (!client.value) return 'Prijava trenutačno nije dostupna.'
    try {
      const { data, error: exchangeError } = await client.value.auth.exchangeCodeForSession(code)
      if (exchangeError) return callbackError(exchangeError)
      const cookieSync = replaceSession(data.session)
      error.value = null
      const [cookieError, syncError] = await Promise.all([cookieSync, applyServerSync(data.session)])
      if (cookieError && isCurrentSession(data.session)) error.value = cookieError
      return cookieError ?? syncError
    } catch (cause) {
      return callbackError(cause)
    }
  }

  async function signOut() {
    if (!client.value) return
    initializing.value = true
    const previousSession = session.value
    const previousRole = accountRole.value
    void replaceSession(null)
    try {
      const { error: signOutError } = await client.value.auth.signOut()
      if (signOutError) throw signOutError
      const cookieError = await syncEditorialCookie(session.value)
      if (cookieError) return cookieError
      if (!session.value) error.value = null
    } catch {
      const message = 'Odjava nije uspjela. Pokušaj ponovno.'
      if (session.value) return message
      const cookieSync = replaceSession(previousSession)
      accountRole.value = previousRole
      const cookieError = await cookieSync
      if (previousSession) await applyServerSync(previousSession)
      if (cookieError) {
        if (isCurrentSession(previousSession)) error.value = cookieError
        return cookieError
      }
      if (isCurrentSession(previousSession)) error.value = message
      return message
    } finally {
      initializing.value = false
    }
  }

  return { session, user, role, configured, initialized, loading, error, initialize, signIn, finishCallback, signOut }
}
