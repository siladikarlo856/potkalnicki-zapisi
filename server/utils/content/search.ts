import { contentFold } from '../../../shared/utils/content/common'

// How the admin list and the select-menu lookups search. `search_text` is the folded text the database keeps
// per row (accents removed, lowercased); a kind may also name one column that is not folded (`searchAlso`).

/** An `ilike` pattern for the folded search text; LIKE wildcards in the query are matched literally. */
export function searchPattern(value: string) {
  const folded = contentFold(value.trim()).replace(/\*/g, '').replace(/[\\%_]/g, char => `\\${char}`)
  return `%${folded}%`
}

/**
 * The same query as a pattern for a column that keeps its accents (a Narrator's real name, which `search_text` leaves
 * out unless the narrator consented to be named). The letters that have an accented form (c, d, s, z) match any one
 * character, so "simun" finds "Šimun" and "cakovec" finds "Čakovec"; it may match a little more than asked, which is
 * fine for an editor's lookup.
 */
export function accentTolerantPattern(value: string) {
  return searchPattern(value).replace(/[cdsz]/g, '_')
}

/** A filter value in double quotes, so commas and parentheses in it are text and not part of the `or` syntax. */
function quoted(value: string) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/** The PostgREST `or` filter that matches `search_text` or the extra column. Both patterns are quoted, so the query cannot reshape the filter. */
export function searchOrFilter(value: string, column: string) {
  return `search_text.ilike.${quoted(searchPattern(value))},${column}.ilike.${quoted(accentTolerantPattern(value))}`
}
