// Session handling shared by the admin shell, the sign-out button and the editors.
//
// A 401 while an editor is open must not throw the form away (21-admin-screens.md, "Session expired"): the editor
// registers itself with `useAdminEditing()`, `adminApiError` then raises `expired` instead of navigating, the shell
// shows the sign-in dialog over the form and, once the password is accepted, `resume` runs what the editor queued.

const expired = ref(false)
const editors = ref(0)
const resumers = new Set<() => void>()

/** Called by `adminApiError` for a 401 on the client. Returns true when an editor keeps its input and shows the dialog. */
export function raiseAdminSessionExpired() {
  if (!editors.value) return false
  expired.value = true
  return true
}

/**
 * An open editor: while `active()` is true, a 401 asks for the password in place instead of leaving the page, and `onResume`
 * runs once the password is accepted (to repeat the save that was refused).
 */
export function useAdminEditing(active: () => boolean, onResume?: () => void) {
  let counted = false
  function set(on: boolean) {
    if (on === counted) return
    counted = on
    editors.value = Math.max(0, editors.value + (on ? 1 : -1))
    if (onResume) {
      if (on) resumers.add(onResume)
      else resumers.delete(onResume)
    }
  }
  watch(active, set, { immediate: true })
  onScopeDispose(() => set(false))
}

export function useAdminSessionState() {
  async function signIn(password: string) {
    await $fetch('/api/admin/session', { method: 'POST', body: { password } })
    expired.value = false
    for (const resume of [...resumers]) resume()
  }
  return { expired, signIn }
}

export function useAdminSignOut() {
  return async function signOut() {
    await $fetch('/api/admin/session', { method: 'DELETE' })
    await navigateTo('/admin/prijava')
  }
}
