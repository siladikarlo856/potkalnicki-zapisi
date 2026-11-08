import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentIssue, ContentKind, ContentReferenceGroup, ContentStatus, ContentValidation } from '../../../shared/utils/content/common'

// The shape of one entry in the content registry (registry.ts).

export interface ContentFilter {
  column: string
  values: readonly string[]
  /** When the filter value is a key here, the list query uses `in` with these column values. */
  in?: Record<string, readonly string[]>
}

/** Maps tables that do not follow the generic status column (e.g. heritage_words uses active + archived_at). */
export interface ContentKindAdapter {
  columns: Record<string, string>
  toEntity(row: Record<string, unknown>): Record<string, unknown> & { id: string, status: ContentStatus, revision: number }
  toRow(value: Record<string, unknown>): Record<string, unknown>
  archivePatch(): Record<string, unknown>
  /** Push filter conditions for the list query; `status` is the API filter value. */
  statusFilter?(status: ContentStatus, apply: (column: string, value: unknown) => void): void
  createId?(value: Record<string, unknown>): string
}

export interface ContentKindDefinition<V extends { status: ContentStatus } = { status: ContentStatus }> {
  kind: ContentKind
  table: string
  /** Editable API field → database column. `status` and the common columns are handled for every kind. */
  fields: { [K in Exclude<keyof V, 'status'>]: string }
  /** The column that names a row in lookups, references and messages. */
  labelColumn: string
  /**
   * A column, kept with its accents, that the admin search matches besides `search_text` (a Narrator's real name:
   * `search_text` holds it only with consent, but an editor must find the narrator by name either way).
   */
  searchAlso?: string
  /** The shared validator, also used by the admin dialog. */
  validate(input: unknown, id?: string): ContentValidation<V>
  /** Sort key accepted in `?sort=` (prefix `-` for descending) → column; `status`, `updatedAt` and `createdAt` are common. */
  sorts: Record<string, string>
  defaultSort: string
  /** Filters accepted as query parameters, besides the common `status` filter. */
  filters: Record<string, ContentFilter>
  /** Unique index or constraint name → field, so a duplicate is reported on the right field. */
  uniqueConstraints?: Record<string, string>
  /** Rows that refer to this one; blocking groups prevent a hard delete. */
  references?(db: SupabaseClient, id: string): Promise<ContentReferenceGroup[]>
  /** Optional label formatter for lookup menus and the history log (defaults to `labelColumn`). */
  lookupLabel?(row: Record<string, unknown>): string
  /** The row's plain name in the Contributions inbox (a word's headword), when `labelColumn` holds something else. */
  title?(row: Record<string, unknown>): string
  /**
   * The column naming the Contribution a row was made from (a Proposal's Draft): `createDraft` sets it, and the
   * inbox reads it to show what a Proposal became. For every kind but words, publishing the Draft applies that
   * Proposal (content_apply_submission). A kind without it takes no Draft from a Proposal.
   */
  createdFrom?: string
  /**
   * Further columns a Draft records about the Contribution it was made from, by name → column (a word keeps the
   * place as the contributor wrote it in `submission_place`). Only `createDraft` sets them; they are not editable.
   */
  createdFromFields?: Readonly<Record<string, string>>
  /**
   * Editable fields a history restore leaves at their current value, because they select the row
   * rather than describe it (e.g. `isCurrent` of a challenge template).
   */
  restoreKeeps?: ReadonlyArray<Extract<Exclude<keyof V, 'status'>, string>>
  /** Request body cap in bytes; defaults to CONTENT_BODY_LIMIT. */
  bodyLimit?: number
  adapter?: ContentKindAdapter
  /**
   * Editable API fields stored beside the main row (e.g. a person's sources and links). They are validated with
   * the row, saved with it by `persist`, recorded on its revision and restored with it; `load` reads them for one row.
   */
  sidecars?: {
    fields: readonly string[]
    load(db: SupabaseClient, id: string): Promise<Record<string, unknown>>
  }
  /**
   * Read-only API fields computed from other data and never stored (e.g. a word's areas, a person's places
   * label). They are added to every listed and loaded entity, and to the input before validation, so a client
   * cannot dictate them. Receives and returns API-shaped values, in order.
   */
  derive?(db: SupabaseClient, values: Record<string, unknown>[]): Promise<Record<string, unknown>[]>
  /**
   * Rules on a validated value that need the database (e.g. every linked source exists). Runs with
   * `validate`, before any write; a non-empty result refuses the save like any validation issue.
   */
  checkLinks?(db: SupabaseClient, value: V & Record<string, unknown>): Promise<ContentIssue[]>
  /**
   * Saves a validated value — the main row and its sidecars — in one database transaction (typically a
   * per-kind Postgres function). Create, update and history restore always save through it; a kind stored
   * in its main row alone may leave it out and gets the store's single-statement save, while a kind with
   * `sidecars` must define it. An update starts from the full stored entity (sidecars included), so a
   * field the request leaves out keeps its value.
   * It only writes: every rule runs before it, in `validate` and `checkLinks`.
   * Resolves to the saved id, or null when the row is gone or no longer at `options.revision`.
   * Database errors are thrown as they come (PostgREST shape) for the store to map.
   */
  persist?(db: SupabaseClient, id: string | null, value: V & Record<string, unknown>, options: ContentPersistOptions): Promise<string | null>
}

export interface ContentPersistOptions {
  /**
   * The main-table columns for the value (the store's field → column mapping), plus transient columns such as
   * apply_submission_id. On a create by a history restore it also carries `id`, `revision` and `created_at`, so a
   * deleted row comes back under its old id and creation time; these never come from a client.
   */
  row: Record<string, unknown>
  /** On an update: the revision the save is based on. The write happens only while the row is still at it. */
  revision?: number
}

export function defineContentKind<V extends { status: ContentStatus }>(definition: ContentKindDefinition<V>) {
  return definition
}

// The registry erases each kind's value type; the generic handlers only move validated values.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyContentKindDefinition = ContentKindDefinition<any>
