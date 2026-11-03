import type { SupabaseClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import type { ContentKind, ContentReferenceGroup, ContentStatus, ContentValidation } from '../../../shared/utils/content/common'

// The shape of one entry in the content registry (registry.ts).

export interface ContentFilter {
  column: string
  values: readonly string[]
}

export interface ContentKindDefinition<V extends { status: ContentStatus } = { status: ContentStatus }> {
  kind: ContentKind
  table: string
  /** Editable API field → database column. `status` and the common columns are handled for every kind. */
  fields: { [K in Exclude<keyof V, 'status'>]: string }
  /** The column that names a row in lookups, references and messages. */
  labelColumn: string
  /** The shared validator, also used by the admin dialog. */
  validate(input: unknown): ContentValidation<V>
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
   * Editable fields a history restore leaves at their current value, because they select the row
   * rather than describe it (e.g. `isCurrent` of a challenge template).
   */
  restoreKeeps?: ReadonlyArray<Extract<Exclude<keyof V, 'status'>, string>>
  /** Request body cap in bytes; defaults to CONTENT_BODY_LIMIT. */
  bodyLimit?: number
}

export function defineContentKind<V extends { status: ContentStatus }>(definition: ContentKindDefinition<V>) {
  return definition
}

// The registry erases each kind's value type; the generic handlers only move validated values.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyContentKindDefinition = ContentKindDefinition<any>
