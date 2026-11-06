import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentIssue } from '../../../shared/utils/content/common'

// Rules on linked rows (a source, place or heritage item that must exist) need the database, so the
// shared validators cannot check them. Kinds check them in `checkLinks`, before any write, instead of
// letting a sidecar insert in `persistEntity` fail after the main row is already saved.

/**
 * Issues for linked ids that do not name a row of `table` (optionally narrowed by `column = value`).
 * Each link is `[path, id]`, so the issue lands on the field the admin dialog shows.
 */
export async function missingLinkIssues(
  db: SupabaseClient,
  table: string,
  links: ReadonlyArray<readonly [path: string, id: string]>,
  message: string,
  where?: { column: string, value: string }
): Promise<ContentIssue[]> {
  const ids = [...new Set(links.map(([, id]) => id.toLowerCase()))]
  if (!ids.length) return []
  let request = db.from(table).select('id').in('id', ids)
  if (where) request = request.eq(where.column, where.value)
  const { data, error } = await request
  if (error) throw error
  const found = new Set((data ?? []).map(row => String(row.id).toLowerCase()))
  return links.filter(([, id]) => !found.has(id.toLowerCase())).map(([path]) => ({ path, message }))
}

export function missingSourceIssues(db: SupabaseClient, sourceIds: readonly string[] | undefined) {
  return missingLinkIssues(db, 'sources', (sourceIds ?? []).map((id, index) => [`sourceIds.${index}`, id] as const), 'Taj izvor ne postoji.')
}
