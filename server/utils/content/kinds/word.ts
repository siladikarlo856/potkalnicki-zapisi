import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentReferenceGroup, ContentStatus } from '../../../../shared/utils/content/common'
import type { WordEntry, Area } from '../../../../app/types/heritage'
import {
  projectWordRow, validateAdminWord, wordStatusToActive, WORD_BODY_LIMIT
} from '../../../../shared/utils/content/word'
import { defineContentKind } from '../definition'
import { intangibleReferences } from './intangible'
import { whereStatus } from '../store'
import { loadAreaIndex, projectAreas } from '../../wordAreas'

const EXAMPLES = 5

type WordRow = {
  id: string
  entry: WordEntry
  /** Not a column: the areas of the entry, read from the areas table (derive). */
  areas?: Area[]
  active: boolean
  archived_at: string | null
  slug: string | null
  revision: number
  created_at: string
  updated_at: string
  submission_id: number | null
  submission_place: string | null
  search_text: string
}

const WORD_COLUMNS = {
  id: 'id',
  revision: 'revision',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  entry: 'entry',
  slug: 'slug',
  submissionId: 'submission_id',
  submissionPlace: 'submission_place'
} as const

const adapter = {
  columns: {
    ...WORD_COLUMNS,
    active: 'active',
    archivedAt: 'archived_at',
    searchText: 'search_text'
  },
  toEntity(row: Record<string, unknown>) {
    const word = projectWordRow(row as unknown as WordRow)
    return word as unknown as Record<string, unknown> & { id: string, status: ContentStatus, revision: number }
  },
  toRow(value: Record<string, unknown>) {
    const status = value.status as ContentStatus
    const active = wordStatusToActive(status)
    const archivedAt = status === 'archived' ? new Date().toISOString() : null
    return {
      entry: value.entry,
      active,
      ...(archivedAt ? { archived_at: archivedAt } : status === 'published' ? { archived_at: null } : {})
    }
  },
  archivePatch() {
    return { active: false, archived_at: new Date().toISOString() }
  },
  statusFilter(status: ContentStatus, push: (column: string, value: unknown) => void) {
    if (status === 'published') {
      push('active', true)
      push('archived_at', null)
    } else if (status === 'draft') {
      push('active', false)
      push('archived_at', null)
    } else if (status === 'archived') {
      push('archived_at', 'not.null')
    }
  },
  createId(value: Record<string, unknown>) {
    const entry = value.entry as WordEntry
    return entry.id
  }
}

async function wordReferences(db: SupabaseClient, id: string): Promise<ContentReferenceGroup[]> {
  const { data, count, error } = await db.from('heritage_daily_words')
    .select('day', { count: 'exact' })
    .eq('word_id', id)
    .order('day', { ascending: false })
    .limit(EXAMPLES)
  if (error) throw error
  const rows = data ?? []
  return [...await intangibleReferences(db, 'word', id), {
    kind: 'daily_word',
    label: 'Riječ dana',
    count: count ?? rows.length,
    blocking: true,
    items: rows.map(row => ({ id: String(row.day), label: String(row.day), to: '/admin/rijec-dana' }))
  }]
}

export const wordKind = defineContentKind<{ entry: WordEntry, status: ContentStatus }>({
  kind: 'word',
  table: 'heritage_words',
  fields: { entry: 'entry' },
  // `areas`: the areas the entry points at, from the areas table. It is validated, never stored.
  async derive(db, values) {
    const index = await loadAreaIndex(db)
    return values.map(value => ({ ...value, areas: projectAreas(value.entry, index) }))
  },
  lookupLabel: row => wordLookupLabel(row as unknown as Pick<WordRow, 'entry' | 'id'>),
  labelColumn: 'search_text',
  title: row => String((row.entry as WordEntry | undefined)?.headword ?? ''),
  createdFrom: 'submission_id',
  createdFromFields: { submissionPlace: 'submission_place' },
  validate: validateAdminWord,
  sorts: { headword: 'search_text', slug: 'slug' },
  defaultSort: '-updatedAt',
  filters: {},
  references: wordReferences,
  bodyLimit: WORD_BODY_LIMIT,
  adapter,
  uniqueConstraints: { heritage_words_slug_key: 'slug' }
})

interface WordQuery {
  eq(column: string, value: unknown): WordQuery
  is(column: string, value: null): WordQuery
  not(column: string, operator: string, value: unknown): WordQuery
}

/**
 * Narrows a query on heritage_words to Published words, in the word kind's terms (`whereStatus`), for the public
 * word reads that select their own columns. Typed loosely: a typed supabase-js builder is too deep for
 * `whereStatus`' structural check (TS2589).
 */
export function publishedWords<T>(request: T): T {
  return whereStatus(wordKind, request as unknown as WordQuery, 'published') as unknown as T
}

export function wordListLabel(row: WordRow) {
  return row.entry.headword || '(bez naslovne riječi)'
}

export function wordLookupLabel(row: Pick<WordRow, 'entry' | 'id'>) {
  const headword = row.entry.headword?.trim()
  const meaning = row.entry.meaning?.hr?.trim()
  if (headword && meaning) return `${headword} — ${meaning}`
  return headword || meaning || row.id
}
