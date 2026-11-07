import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentReferenceGroup } from '../../../../shared/utils/content/common'
import { formatSeasonLabel, validateClub, type ClubSeasonValue } from '../../../../shared/utils/content/club'
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

async function saveSeasons(db: SupabaseClient, clubId: string, seasons: ClubSeasonValue[]) {
  const { error: deleteError } = await db.from('club_seasons').delete().eq('club_id', clubId)
  if (deleteError) throw deleteError
  if (!seasons.length) return
  const { error } = await db.from('club_seasons').insert(seasons.map(s => ({
    club_id: clubId,
    season: s.season,
    competition: s.competition,
    team: s.team,
    source_url: s.sourceUrl,
    checked_at: s.checkedAt
  })))
  if (error) throw error
}

async function saveSourceIds(db: SupabaseClient, clubId: string, sourceIds: string[]) {
  const { error: deleteError } = await db.from('club_sources').delete().eq('club_id', clubId)
  if (deleteError) throw deleteError
  if (!sourceIds.length) return
  const { error } = await db.from('club_sources').insert(sourceIds.map((source_id, position) => ({ club_id: clubId, source_id, position })))
  if (error) throw error
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
  inputFields: ['seasons', 'sourceIds'],
  loadEntity: async (db, entity) => ({
    seasons: await loadSeasons(db, entity.id),
    sourceIds: await loadSourceIds(db, entity.id)
  }),
  // "A Published club needs a source" is a rule of validateClub, so it is refused before any write.
  checkLinks: async (db, value) => missingSourceIssues(db, value.sourceIds),
  // The clubs row, its seasons and sources in one transaction (supabase/migrations/20261107010000_content_save.sql).
  persist: async (db, id, value, { row, revision }) => {
    const { data, error } = await db.rpc('content_club_save', {
      p_id: id, p_revision: revision ?? null, p_row: row, p_seasons: value.seasons ?? [], p_source_ids: value.sourceIds ?? []
    })
    if (error) throw error
    return (data as string | null) ?? null
  },
  // Still used by a history restore; it moves to `persist` with the restore.
  persistEntity: async (db, id, value) => {
    await saveSeasons(db, id, (value.seasons as ClubSeasonValue[]) ?? [])
    await saveSourceIds(db, id, (value.sourceIds as string[]) ?? [])
  },
  async enrichRows(db, rows) {
    if (!rows.length) return rows
    const ids = rows.map(row => row.id as string)
    const settlementIds = [...new Set(rows.map(row => row.settlement_id as string))]
    const settlementNames = new Map<string, string>()
    if (settlementIds.length) {
      const { data: areas } = await db.from('areas').select('id,name').in('id', settlementIds)
      for (const area of areas ?? []) settlementNames.set(area.id as string, area.name as string)
    }
    const seasonLabels = new Map<string, string>()
    const { data: seasons, error } = await db.from('club_seasons').select('club_id,season,competition,team').in('club_id', ids).eq('team', 'seniori').order('season', { ascending: false })
    if (error) throw error
    for (const row of seasons ?? []) {
      const key = row.club_id as string
      if (seasonLabels.has(key)) continue
      seasonLabels.set(key, `${formatSeasonLabel(row.season as string)} · ${row.competition as string}`)
    }
    return rows.map(row => ({
      ...row,
      settlement_label: settlementNames.get(row.settlement_id as string) ?? null,
      season_summary: seasonLabels.get(row.id as string) ?? null
    }))
  },
  toEntityExtra(row: Record<string, unknown>) {
    return {
      settlementLabel: (row.settlement_label as string | null | undefined) ?? null,
      seasonSummary: (row.season_summary as string | null | undefined) ?? null
    }
  }
})
