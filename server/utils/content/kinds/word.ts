import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentReferenceGroup, ContentStatus } from '../../../../shared/utils/content/common'
import type { WordEntry, Area } from '../../../../app/types/heritage'
import {
  projectWordRow, validateAdminWord, wordStatusToActive, WORD_BODY_LIMIT
} from '../../../../shared/utils/content/word'
import { defineContentKind } from '../definition'
import { loadAreaIndex, projectAreas } from '../../wordAreas'

const EXAMPLES = 5

type WordRow = {
  id: string
  entry: WordEntry
  /** Not a column: the areas of the entry, read from the areas table (enrichRows, loadEntity). */
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
  lookupLabel(row: Record<string, unknown>) {
    return wordLookupLabel(row as unknown as Pick<WordRow, 'entry' | 'id'>)
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
  return [{
    kind: 'daily_word',
    label: 'Riječ dana',
    count: count ?? rows.length,
    blocking: true,
    items: rows.map(row => ({ id: String(row.day), label: String(row.day), to: '/admin/rijec-dana' }))
  }]
}

export const wordKind = defineContentKind({
  kind: 'word',
  table: 'heritage_words',
  // `areas` is derived: the areas the entry points at, from the areas table. It is validated, never stored.
  fields: { entry: 'entry', areas: 'areas' },
  derivedFields: ['areas'],
  async prepareInput(db, input) {
    return { ...input, areas: projectAreas(input.entry, await loadAreaIndex(db)) }
  },
  async enrichRows(db, rows) {
    const index = await loadAreaIndex(db)
    return rows.map(row => ({ ...row, areas: projectAreas(row.entry, index) }))
  },
  async loadEntity(db, entity) {
    return { areas: projectAreas(entity.entry, await loadAreaIndex(db)) }
  },
  labelColumn: 'search_text',
  validate: validateAdminWord,
  sorts: { headword: 'search_text', slug: 'slug' },
  defaultSort: '-updatedAt',
  filters: {},
  references: wordReferences,
  bodyLimit: WORD_BODY_LIMIT,
  adapter,
  uniqueConstraints: { heritage_words_slug_key: 'slug' }
})

export function wordListLabel(row: WordRow) {
  return row.entry.headword || '(bez naslovne riječi)'
}

export function wordLookupLabel(row: Pick<WordRow, 'entry' | 'id'>) {
  const headword = row.entry.headword?.trim()
  const meaning = row.entry.meaning?.hr?.trim()
  if (headword && meaning) return `${headword} — ${meaning}`
  return headword || meaning || row.id
}
