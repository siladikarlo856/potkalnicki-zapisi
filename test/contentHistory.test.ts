import { describe, expect, it } from 'vitest'
import { CONTENT_KINDS, CONTENT_STATUSES } from '../shared/utils/content/common'
import {
  HISTORY_ACTIONS, HISTORY_ACTION_LABELS, HISTORY_ACTOR_LABELS, HISTORY_ACTOR_PATTERN, HISTORY_ACTORS, HISTORY_FIELDS, HISTORY_KINDS, HISTORY_KIND_META,
  diffSnapshots, formatHistoryValue, historyFieldMeta, isHistoryKind
} from '../shared/utils/content/history'
import { SOURCE_TYPES } from '../shared/utils/content/source'
import { findContentKind } from '../server/utils/content/registry'

describe('history vocabulary', () => {
  it('names every kind the audit triggers write, and every registered kind is among them', () => {
    expect(Object.keys(HISTORY_KIND_META).sort()).toEqual([...HISTORY_KINDS].sort())
    for (const kind of CONTENT_KINDS) expect(isHistoryKind(kind), kind).toBe(true)
    expect(isHistoryKind('sources')).toBe(false)
    for (const meta of Object.values(HISTORY_KIND_META)) expect(meta.adminPath).toMatch(/^\/admin\/[a-z-]+$/)
  })

  it('labels every action and the known authors', () => {
    expect(Object.keys(HISTORY_ACTION_LABELS).sort()).toEqual([...HISTORY_ACTIONS].sort())
    for (const actor of HISTORY_ACTORS) expect(HISTORY_ACTOR_LABELS[actor]).toBeTruthy()
    expect(HISTORY_ACTOR_PATTERN.test('admin')).toBe(true)
    expect(HISTORY_ACTOR_PATTERN.test('submission:12')).toBe(true)
    expect(HISTORY_ACTOR_PATTERN.test('Admin; drop')).toBe(false)
  })

  it('labels every editable field of every registered kind and the status values', () => {
    for (const kind of CONTENT_KINDS) {
      const def = findContentKind(kind)!
      expect(Object.keys(HISTORY_FIELDS[kind]).sort(), kind).toEqual(Object.keys(def.fields).sort())
    }
    expect(Object.keys(historyFieldMeta('source', 'status').values!).sort()).toEqual([...CONTENT_STATUSES].sort())
    expect(Object.keys(historyFieldMeta('source', 'type').values!).sort()).toEqual([...SOURCE_TYPES].sort())
    expect(historyFieldMeta('source', 'unknown')).toEqual({ label: 'unknown' })
  })

  it('finds definitions of registered kinds only', () => {
    expect(findContentKind('source')?.table).toBe('sources')
    expect(findContentKind('word')).toBeUndefined()
    expect(findContentKind('constructor')).toBeUndefined()
  })
})

describe('diffSnapshots', () => {
  const fields = ['title', 'url', 'note', 'status']

  it('lists only the fields whose value differs, in field order', () => {
    expect(diffSnapshots(
      { title: 'A', url: null, note: 'x', status: 'draft', revision: 1 },
      { title: 'B', url: null, note: 'x', status: 'published', revision: 2 },
      fields
    )).toEqual([
      { field: 'title', before: 'A', after: 'B' },
      { field: 'status', before: 'draft', after: 'published' }
    ])
  })

  it('treats a missing value and null as the same, but an empty string as different from null', () => {
    expect(diffSnapshots({ title: 'A' }, { title: 'A', url: null }, fields)).toEqual([])
    expect(diffSnapshots({ title: 'A', note: null }, { title: 'A', note: '' }, fields)).toEqual([{ field: 'note', before: null, after: '' }])
  })

  it('compares structured values by content', () => {
    expect(diffSnapshots({ tags: ['a', 'b'] }, { tags: ['a', 'b'] }, ['tags'])).toEqual([])
    expect(diffSnapshots({ tags: ['a', 'b'] }, { tags: ['a'] }, ['tags'])).toHaveLength(1)
  })

  it('lists the fields that hold a value for a creation and a deletion', () => {
    const row = { title: 'A', url: null, note: '', status: 'published' }
    expect(diffSnapshots(null, row, fields)).toEqual([
      { field: 'title', before: null, after: 'A' },
      { field: 'status', before: null, after: 'published' }
    ])
    expect(diffSnapshots(row, null, fields)).toEqual([
      { field: 'title', before: 'A', after: null },
      { field: 'status', before: 'published', after: null }
    ])
  })
})

describe('formatHistoryValue', () => {
  it('shows empty values as a dash and coded values by label', () => {
    const type = historyFieldMeta('source', 'type')
    expect(formatHistoryValue(type, null)).toBe('—')
    expect(formatHistoryValue(type, '')).toBe('—')
    expect(formatHistoryValue(type, 'dictionary')).toBe('Rječnik')
    expect(formatHistoryValue(type, 'unlisted')).toBe('unlisted')
    expect(formatHistoryValue(historyFieldMeta('source', 'status'), 'archived')).toBe('Arhivirano')
    expect(formatHistoryValue({ label: 'x' }, true)).toBe('Da')
    expect(formatHistoryValue({ label: 'x' }, 0)).toBe('0')
    expect(formatHistoryValue({ label: 'x' }, ['a'])).toBe('["a"]')
  })
})
