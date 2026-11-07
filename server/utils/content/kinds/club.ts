import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentReferenceGroup } from '../../../../shared/utils/content/common'
import { formatSeasonLabel, validateClub } from '../../../../shared/utils/content/club'
import { defineContentKind } from '../definition'
import { missingSourceIssues } from '../linkCheck'

async function loadSeasons(db: SupabaseClient, clubId: string) {
  const { data, error } = await db.from('club_seasons').select('season,competition,team,source_url,checked_at').eq('club_id', clubId).order('season', { ascending: false }).order('team')
  if (error) throw error
  return (data ?? []).map(row => ({
    season: row.season as string,
    competition: row.competition as string,
    team: row.team as string,
    sourceUrl: row.source_url as string | null,
    checkedAt: row.checked_at as string
  }))
}

async function loadSourceIds(db: SupabaseClient, clubId: string) {
  const { data, error } = await db.from('club_sources').select('source_id,position').eq('club_id', clubId).order('position')
  if (error) throw error
  return (data ?? []).map(row => row.source_id as string)
}

export const clubKind = defineContentKind({
  kind: 'club',
  table: 'clubs',
  fields: {
    name: 'name',
    slug: 'slug',
    fullName: 'full_name',
    sport: 'sport',
    settlementId: 'settlement_id',
    foundedYear: 'founded_year',
    homeGround: 'home_ground',
    researchNotes: 'research_notes',
    verification: 'verification',
    noindex: 'noindex'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  labelColumn: 'name',
  createdFrom: 'source_submission_id',
  validate: validateClub,
  sorts: { name: 'name', sport: 'sport', verification: 'verification' },
  defaultSort: 'name',
  filters: {
    verification: { column: 'verification', values: ['unverified', 'in_review', 'verified', 'needs_update'] }
  },
  uniqueConstraints: { clubs_slug_key: 'slug' },
  references: async (db, id) => {
    const groups: ContentReferenceGroup[] = []
    const { count, error } = await db.from('club_seasons').select('club_id', { count: 'exact', head: true }).eq('club_id', id)
    if (error) throw error
    if (count) groups.push({ kind: 'club_season', label: 'Sezone', count, blocking: false, items: [] })
    return groups
  },
  sidecars: {
    fields: ['seasons', 'sourceIds'],
    load: async (db, id) => ({ seasons: await loadSeasons(db, id), sourceIds: await loadSourceIds(db, id) })
  },
  // "A Published club needs a source" is a rule of validateClub, so it is refused before any write.
  checkLinks: async (db, value) => missingSourceIssues(db, value.sourceIds),
  // The clubs row, its seasons and sources in one transaction (supabase/migrations/20261107000000_content_save.sql).
  persist: async (db, id, value, { row, revision }) => {
    const { data, error } = await db.rpc('content_club_save', {
      p_id: id, p_revision: revision ?? null, p_row: row, p_seasons: value.seasons ?? [], p_source_ids: value.sourceIds ?? []
    })
    if (error) throw error
    return (data as string | null) ?? null
  },
  // The settlement's name and the latest senior season, for the admin list.
  async derive(db, values) {
    const ids = values.map(value => value.id).filter((id): id is string => typeof id === 'string')
    const settlementIds = [...new Set(values.map(value => value.settlementId).filter((id): id is string => typeof id === 'string'))]
    const settlementNames = new Map<string, string>()
    if (settlementIds.length) {
      const { data: areas, error } = await db.from('areas').select('id,name').in('id', settlementIds)
      if (error) throw error
      for (const area of areas ?? []) settlementNames.set(area.id as string, area.name as string)
    }
    const seasonLabels = new Map<string, string>()
    if (ids.length) {
      const { data: seasons, error } = await db.from('club_seasons').select('club_id,season,competition,team').in('club_id', ids).eq('team', 'seniori').order('season', { ascending: false })
      if (error) throw error
      for (const row of seasons ?? []) {
        const key = row.club_id as string
        if (seasonLabels.has(key)) continue
        seasonLabels.set(key, `${formatSeasonLabel(row.season as string)} · ${row.competition as string}`)
      }
    }
    return values.map(value => ({
      ...value,
      settlementLabel: settlementNames.get(value.settlementId as string) ?? null,
      seasonSummary: seasonLabels.get(value.id as string) ?? null
    }))
  }
})
