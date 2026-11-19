import type { ContentKind, ContentList } from '~~/shared/utils/content/common'
import type { DailyAdminOverview } from '~~/shared/utils/dailyAdmin'
import type { HistoryLog } from '~~/shared/utils/content/history'
import type { InboxList } from '~~/shared/types/inbox'
import { SUBMISSION_TYPES } from '~~/shared/utils/submission'
import type { PzNoun } from '~/utils/pzText'

/** What a pending contribution is called, counted: "3 ispravka", "2 riječi". */
const TYPE_NOUNS: Record<(typeof SUBMISSION_TYPES)[number], PzNoun> = {
  word: ['riječ', 'riječi'],
  expression: ['izraz', 'izraza'],
  memory: ['sjećanje', 'sjećanja'],
  other: ['drugo', 'drugo'],
  correction: ['ispravak', 'ispravka', 'ispravaka'],
  proposal: ['prijedlog', 'prijedloga']
}

// What "Nadzorna ploča" shows, read from the admin APIs that already exist (no new endpoint, nothing stored). Each source
// loads on its own, so one failing leaves the others on screen (state `djelomicna-greska`).

/** Kinds whose rows carry a verification the editors keep current. */
const VERIFIED_KINDS: ContentKind[] = ['heritage_item', 'person', 'story', 'custom', 'folk_text']
/** Kinds whose drafts are counted when they have waited too long. */
const DRAFT_KINDS: ContentKind[] = ['area', 'heritage_item', 'person', 'club', 'word', 'story', 'custom', 'folk_text']
export const STALE_DRAFT_DAYS = 30
export const DAILY_HORIZON_DAYS = 14
const DAY_MS = 86_400_000

const list = (kind: ContentKind, query: Record<string, string | number>) =>
  $fetch<ContentList<{ updatedAt: string }>>(`/api/admin/content/${kind}`, { query })

/** Calendar days after `from` (a `YYYY-MM-DD` day) that have no pinned word, within the horizon. */
export function daysWithoutPin(overview: Pick<DailyAdminOverview, 'day' | 'pins'>, horizon = DAILY_HORIZON_DAYS) {
  const pinned = new Set(overview.pins.map(pin => pin.day))
  const start = new Date(`${overview.day}T00:00:00Z`).getTime()
  const days: string[] = []
  for (let offset = 1; offset <= horizon; offset++) {
    const day = new Date(start + offset * DAY_MS).toISOString().slice(0, 10)
    if (!pinned.has(day)) days.push(day)
  }
  return days
}

export interface KindCount {
  kind: ContentKind
  count: number
}

/** The total, and the kinds that contribute to it (largest first), so the card can say where the work is and link there. */
function summarize(byKind: KindCount[]) {
  const found = byKind.filter(entry => entry.count).sort((a, b) => b.count - a.count)
  return { total: found.reduce((sum, entry) => sum + entry.count, 0), byKind: found }
}

export function useAdminDashboard() {
  const opts = { server: false, lazy: true, default: () => null } as const

  const inbox = useAsyncData('admin-dash-inbox', async () => {
    const result = await $fetch<InboxList>('/api/admin/inbox', { query: { status: 'pending', size: 100 } })
    const counts = SUBMISSION_TYPES
      .map(type => ({ type, count: result.rows.filter(row => row.type === type).length }))
      .filter(entry => entry.count)
      .sort((a, b) => b.count - a.count)
      .map(entry => ({ ...entry, phrase: `${entry.count} ${nounFor(entry.count, TYPE_NOUNS[entry.type])}` }))
    return { total: result.counts.pending, counts }
  }, opts)

  const outdated = useAsyncData('admin-dash-outdated', async () => {
    const byKind = await Promise.all(VERIFIED_KINDS.map(async kind => ({ kind, count: (await list(kind, { verification: 'needs_update', size: 25 })).total })))
    return summarize(byKind)
  }, opts)

  const drafts = useAsyncData('admin-dash-drafts', async () => {
    const limit = Date.now() - STALE_DRAFT_DAYS * DAY_MS
    const byKind = await Promise.all(DRAFT_KINDS.map(async kind => ({
      kind,
      count: (await list(kind, { status: 'draft', sort: 'updatedAt', size: 100 })).rows.filter(row => new Date(row.updatedAt).getTime() < limit).length
    })))
    return summarize(byKind)
  }, opts)

  const daily = useAsyncData('admin-dash-daily', async () => {
    const overview = await $fetch<DailyAdminOverview>('/api/review/daily')
    return { overview, gaps: daysWithoutPin(overview) }
  }, opts)

  const recent = useAsyncData('admin-dash-recent', () => $fetch<HistoryLog>('/api/admin/history', { query: { size: 6 } }), opts)

  const places = useAsyncData('admin-dash-places', async () => ({ total: (await list('area', { size: 25 })).total }), opts)

  const sources = { inbox, outdated, drafts, daily, recent, places }
  const loading = computed(() => Object.values(sources).some(source => source.status.value === 'pending' || source.status.value === 'idle'))
  const failed = computed(() => Object.entries(sources).filter(([, source]) => source.status.value === 'error').map(([name]) => name))
  function refresh() {
    return Promise.all(Object.values(sources).map(source => source.refresh()))
  }
  return { ...sources, loading, failed, refresh }
}
