import type { SupabaseClient } from '@supabase/supabase-js'
import type { Area, WordEntry } from '../../app/types/heritage'

// The areas a word refers to, read from the `areas` table. A word's usages and examples name areas by
// id; the public `Area` shape (the areas plus their ancestors, which the games and the daily word walk up)
// is built here from the table. It used to be a per-word copy in heritage_words.areas, which a database
// trigger kept in step; nothing reads or writes that column any more.

interface AreaRow {
  id: string
  name: string
  kind: Area['kind']
  parent_id: string | null
  official_code: string | null
  geonames_id: string | number | null
}

export type AreaIndex = ReadonlyMap<string, Area>

// Supabase's API returns at most 1000 rows per request (max_rows).
const PAGE_SIZE = 1000

/** Every area by id, in the public `Area` shape. Archived and draft areas are included: a word keeps pointing at them. */
export async function loadAreaIndex(client: SupabaseClient): Promise<AreaIndex> {
  const index = new Map<string, Area>()
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client.from('areas').select('id,name,kind,parent_id,official_code,geonames_id')
      .order('id').range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`[word-areas] Supabase request failed: ${error.message}`)
    for (const row of (data ?? []) as AreaRow[]) {
      const externalIds: Record<string, string> = {}
      if (row.official_code) externalIds.dgu = String(row.official_code)
      if (row.geonames_id) externalIds.geonames = String(row.geonames_id)
      index.set(row.id, {
        id: row.id, name: row.name, kind: row.kind, parentId: row.parent_id ?? null,
        ...(Object.keys(externalIds).length ? { externalIds } : {})
      })
    }
    if ((data?.length ?? 0) < PAGE_SIZE) return index
  }
}

function objects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item)) : []
}

/** The area ids named by a stored entry's variant usages and examples, each once, in order of appearance. */
export function entryAreaIds(entry: unknown): string[] {
  const body = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
  const ids = new Set<string>()
  for (const variant of objects(body.variants)) {
    for (const usage of objects(variant.usages)) if (typeof usage.areaId === 'string') ids.add(usage.areaId)
  }
  for (const example of objects(body.examples)) if (typeof example.areaId === 'string') ids.add(example.areaId)
  return [...ids]
}

/**
 * The areas an entry points at plus their ancestors, each once and parents before children. An id the table does
 * not know (a stale legacy key, a deleted area) is left out, so the usage that names it fails validation like any
 * unknown area and the word fails closed.
 */
export function projectAreas(entry: unknown, index: AreaIndex): Area[] {
  const result = new Map<string, Area>()
  for (const id of entryAreaIds(entry)) {
    const chain: Area[] = []
    for (let area = index.get(id); area && !result.has(area.id) && !chain.includes(area); area = area.parentId ? index.get(area.parentId) : undefined) chain.unshift(area)
    for (const area of chain) result.set(area.id, area)
  }
  return [...result.values()]
}

/** Rows of heritage_words (at least `entry`) with the areas of their entry. */
export async function withProjectedAreas<T extends { entry: unknown }>(client: SupabaseClient, rows: T[]): Promise<Array<T & { areas: Area[] }>> {
  if (!rows.length) return []
  const index = await loadAreaIndex(client)
  return rows.map(row => ({ ...row, areas: projectAreas(row.entry as WordEntry, index) }))
}
