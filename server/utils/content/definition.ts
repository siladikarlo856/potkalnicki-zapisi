import type { SupabaseClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
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
  lookupLabel?(row: Record<string, unknown>): string
  createId?(value: Record<string, unknown>): string
}

export interface ContentKindDefinition<V extends { status: ContentStatus } = { status: ContentStatus }> {
  kind: ContentKind
  table: string
  /** Editable API field → database column. `status` and the common columns are handled for every kind. */
  fields: { [K in Exclude<keyof V, 'status'>]: string }
  /** The column that names a row in lookups, references and messages. */
  labelColumn: string
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
  /** Runs after every successful write, e.g. to invalidate a public content cache. */
  afterWrite?(event: H3Event): void | Promise<void>
  /**
   * API fields that are not stored with the row but derived from other data (for example the areas a word's
   * entry points at). They are validated like any field, but are left out of the change history and not restored.
   */
  derivedFields?: readonly string[]
  /** Fills derived fields from the database before validation; a client cannot dictate them. */
  prepareInput?(db: SupabaseClient, input: Record<string, unknown>): Promise<Record<string, unknown>>
  enrichRows?(db: SupabaseClient, rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]>
  toEntityExtra?(row: Record<string, unknown>): Record<string, unknown>
  /** Optional label formatter for lookup menus (defaults to `labelColumn`). */
  lookupLabel?(row: Record<string, unknown>): string
  /**
   * Editable fields a history restore leaves at their current value, because they select the row
   * rather than describe it (e.g. `isCurrent` of a challenge template).
   */
  restoreKeeps?: ReadonlyArray<Extract<Exclude<keyof V, 'status'>, string>>
  /** Request body cap in bytes; defaults to CONTENT_BODY_LIMIT. */
  bodyLimit?: number
  adapter?: ContentKindAdapter
  /** Validated API fields that are not columns on the main table (synced in `persistEntity`). */
  inputFields?: readonly string[]
  /** Loads API fields not stored on the main row (e.g. region membership). */
  loadEntity?(db: SupabaseClient, entity: Record<string, unknown> & { id: string }): Promise<Record<string, unknown>>
  /**
   * Rules on a validated value that need the database (e.g. every linked source exists). Runs with
   * `validate`, before any write; a non-empty result refuses the save like any validation issue.
   */
  checkLinks?(db: SupabaseClient, value: V & Record<string, unknown>): Promise<ContentIssue[]>
  /**
   * Persists API fields not stored on the main row after a successful save or restore. It only
   * writes: every rule belongs in `validate` or `checkLinks`, which run before the main row is saved.
   */
  persistEntity?(db: SupabaseClient, id: string, value: Record<string, unknown>): Promise<void>
}

export function defineContentKind<V extends { status: ContentStatus }>(definition: ContentKindDefinition<V>) {
  return definition
}

// The registry erases each kind's value type; the generic handlers only move validated values.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyContentKindDefinition = ContentKindDefinition<any>
