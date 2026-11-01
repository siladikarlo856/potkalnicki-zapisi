import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateWord } from '../shared/utils/word'

const sql = readFileSync(new URL('../supabase/migrations/20261101010000_seed_kajkavian_words.sql', import.meta.url), 'utf8')
const statements = [...sql.matchAll(/^insert into public\.heritage_words \(id, entry, areas, active\) values \('([^']+)', '(.*)'::jsonb, '\[\]'::jsonb, true\)/gm)]
  .map(match => ({ id: match[1]!, entry: JSON.parse(match[2]!.replaceAll('\'\'', '\'')) }))

describe('Kajkavian word seed migration', () => {
  it('seeds 55 unique ASCII ids with entries that match their row id', () => {
    expect(statements).toHaveLength(55)
    expect(new Set(statements.map(s => s.id)).size).toBe(55)
    for (const { id, entry } of statements) {
      expect(id).toMatch(/^[a-z0-9-]+$/)
      expect(entry.id).toBe(id)
    }
    expect(statements.map(s => s.id)).toEqual(expect.arrayContaining(['fiskal', 'mustaci']))
    expect(statements.find(s => s.id === 'fiskal')?.entry.headword).toBe('fiškal')
    expect(statements.find(s => s.id === 'mustaci')?.entry.headword).toBe('mustači')
  })

  it('validates every entry as an active word and keeps it a placeholder without usages', () => {
    for (const { id, entry } of statements) {
      const { issues } = validateWord({ entry, areas: [], active: true }, id)
      expect(issues, id).toEqual([])
      expect(entry.status).toBe('placeholder')
      expect(entry.variants.every((v: { usages: unknown[] }) => v.usages.length === 0)).toBe(true)
    }
  })
})

describe('active words without places', () => {
  const base = { id: 'x', headword: 'x', meaning: { hr: 'y' }, partOfSpeech: 'imenica', status: 'community', sources: [{ id: 's', kind: 'editor' }], variants: [{ id: 'x-v1', form: 'x', status: 'community', usages: [] }] }

  it('accepts empty usages but keeps the other active requirements', () => {
    expect(validateWord({ entry: base, areas: [], active: true }, 'x').issues).toEqual([])
    expect(validateWord({ entry: { ...base, sources: [] }, areas: [], active: true }, 'x').issues).not.toEqual([])
    expect(validateWord({ entry: { ...base, variants: [{ ...base.variants[0], form: 'z' }] }, areas: [], active: true }, 'x').issues).not.toEqual([])
    expect(validateWord({ entry: { ...base, partOfSpeech: '' }, areas: [], active: true }, 'x').issues).not.toEqual([])
  })
})
