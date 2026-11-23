import type { PzNoun } from '~/utils/pzText'

/** "7 priloga čeka pregled": the inbox count as the accessible phrase, inflected (PendingBadge). */
export const PENDING_NOUN: PzNoun = ['prilog čeka pregled', 'priloga čekaju pregled', 'priloga čeka pregled']

/**
 * The inbox's pending count, shared by every form of the shell (sidebar, rail, phone bar) and the dashboard. The shell stays
 * usable when the count cannot be read, so a failed request is just no badge.
 */
export function useAdminPending() {
  const $fetch = useEditorialFetch()
  const { data, refresh } = useFetch<{ pending: number }>('/api/admin/inbox/summary', { $fetch, server: false, key: 'admin-inbox-summary' })
  return { pending: computed(() => data.value?.pending ?? 0), refresh }
}
