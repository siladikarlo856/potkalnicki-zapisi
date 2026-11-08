import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentLookupItem, ContentStatus } from '../../../shared/utils/content/common'
import { CONTENT_LOOKUP_LIMIT, CONTENT_SEARCH_MAX, contentFold, isUuid } from '../../../shared/utils/content/common'
import { AREA_KINDS as ALL_AREA_KINDS, AREA_KIND_LABELS } from '../../../shared/utils/content/area'
import type { AreaKind } from '../../../shared/utils/content/area'
import { municipalityLabel } from '../publicContent'
import type { PublicMunicipalityKind } from '../../../shared/types/publicAtlas'
import { fail, queryText } from '../content/store'

const AREA_KINDS = {
  municipality: ['town', 'municipality'] as const,
  settlement: ['settlement'] as const,
  // Every level, for links that may name a settlement, a municipality or a whole region (Priče i običaji).
  all: ALL_AREA_KINDS
}

function searchPattern(value: string) {
  const folded = contentFold(value.trim()).replace(/\*/g, '').replace(/[\\%_]/g, char => `\\${char}`)
  return `%${folded}%`
}

function areaLabel(kind: string, name: string, scope: string) {
  // In the all-levels menu a name alone is ambiguous (a town and its settlement), so the level follows it.
  if (scope === 'all') return `${name} · ${AREA_KIND_LABELS[kind as AreaKind] ?? kind}`
  if (kind === 'settlement') return name
  return municipalityLabel(kind as PublicMunicipalityKind, name)
}

/** Lookup for area pickers (Mjesta admin is a separate PR; heritage items need town/municipality and settlement menus). */
export async function lookupAreas(event: H3Event) {
  const query = getQuery(event)
  const q = queryText(query.q, 'q').trim()
  if (q.length > CONTENT_SEARCH_MAX) fail(400, 'Invalid q', { message: `Pretraga može imati najviše ${CONTENT_SEARCH_MAX} znakova.` })
  const scope = queryText(query.scope, 'scope') || 'municipality'
  if (!(scope in AREA_KINDS)) fail(400, 'Invalid scope', { message: 'Parametar scope nije ispravan.' })
  const parent = queryText(query.parent, 'parent')
  if (scope === 'settlement' && parent && !isUuid(parent)) fail(400, 'Invalid parent', { message: 'Parametar parent nije ispravan.' })
  const idsText = queryText(query.ids, 'ids')
  const ids = idsText ? idsText.split(',') : []
  if (ids.length > 50 || (ids.length && !ids.every(isUuid))) fail(400, 'Invalid ids', { message: 'Parametar ids nije ispravan.' })

  const db = useDatabaseClient()
  let request = db.from('areas').select('id,kind,name,slug,status').in('kind', [...AREA_KINDS[scope as keyof typeof AREA_KINDS]])
  if (ids.length) {
    request = request.in('id', ids.map(id => id.toLowerCase()))
  } else {
    request = request.neq('status', 'archived')
    if (scope === 'settlement' && parent) request = request.eq('parent_id', parent.toLowerCase())
    if (q) request = request.ilike('search_text', searchPattern(q))
  }
  const { data, error } = await request.order('name').order('id').limit(ids.length || CONTENT_LOOKUP_LIMIT)
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') fail(503, 'Content tables are not migrated', { code: 'not-migrated', message: 'Tablice sadržaja još nisu postavljene u bazi.' })
    throw error
  }
  const items: ContentLookupItem[] = (data ?? []).map((row) => {
    const kind = row.kind as string
    const name = row.name as string
    return {
      id: row.id as string,
      label: areaLabel(kind, name, scope),
      status: row.status as ContentStatus
    }
  })
  return { items }
}

export async function suggestContentSlug(
  db: SupabaseClient,
  table: string,
  base: string,
  scopeId: string | null,
  excludeId?: string
) {
  const slug = base.trim().toLowerCase()
  if (!slug) return ''
  let candidate = slug
  for (let n = 2; n < 100; n++) {
    let request = db.from(table).select('id').eq('slug', candidate).limit(1)
    if (table === 'heritage_items' && scopeId) request = request.eq('settlement_id', scopeId)
    else if (table === 'heritage_items') request = request.is('settlement_id', null)
    const { data, error } = await request
    if (error) throw error
    const taken = (data ?? []).some(row => row.id !== excludeId)
    if (!taken) return candidate
    candidate = `${slug}-${n}`
  }
  return `${slug}-99`
}
