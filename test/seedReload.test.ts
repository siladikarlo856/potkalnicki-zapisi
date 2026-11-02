import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DAILY_CATEGORIES } from '../shared/utils/dailyWord'
import { validateWord } from '../shared/utils/word'

const read = (name: string) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
const sql = read('20261102120000_reload_seed_words.sql')
const unquote = (text: string) => JSON.parse(text.replaceAll('\'\'', '\''))
const rows = [...sql.matchAll(/^insert into public\.heritage_words \(id, entry, areas, active\) values \('([^']+)', '(.*)'::jsonb, '(.*)'::jsonb, (true|false)\) on conflict \(id\) do nothing;$/gm)]
  .map(m => ({ id: m[1]!, entry: unquote(m[2]!), areas: unquote(m[3]!), active: m[4] === 'true' }))
const deleteList = [...sql.match(/delete from public\.heritage_words where submission_id is null and id = any \(array\[([^\]]*)\]\)/)![1]!.matchAll(/'([^']+)'/g)].map(m => m[1]!)
const oldIds = [...new Set([...read('20261028010000_heritage_words.sql').matchAll(/values \('([^']+)', '/g), ...read('20261101010000_seed_kajkavian_words.sql').matchAll(/values \('([^']+)', '/g)].map(m => m[1]!))]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('seed word reload migration', () => {
  it('deletes exactly the 61 previously seeded ids, only unlinked rows, and none of the new ones', () => {
    expect(oldIds).toHaveLength(61)
    expect([...deleteList].sort()).toEqual([...oldIds].sort())
    expect(sql).toContain('delete from public.heritage_daily_words where word_id in (')
    expect(deleteList.some(id => UUID.test(id))).toBe(false)
    expect(sql.match(/^ *(?:delete from public\.heritage_words|select id from public\.heritage_words) where submission_id is null/gm)).toHaveLength(2)
  })

  it('removes dependent daily-word rows before the words, with the guard trigger restored', () => {
    const at = (text: string) => sql.indexOf(text)
    expect(at('disable trigger heritage_daily_word_guard')).toBeLessThan(at('delete from public.heritage_daily_words'))
    expect(at('delete from public.heritage_daily_words')).toBeLessThan(at('enable trigger heritage_daily_word_guard'))
    expect(at('enable trigger heritage_daily_word_guard')).toBeLessThan(at('delete from public.heritage_words'))
    expect(at('delete from public.heritage_words')).toBeLessThan(at('insert into public.heritage_words'))
    expect(sql).toMatch(/^begin;$/m)
    expect(sql).toMatch(/^commit;$/m)
  })

  it('inserts 61 words with unique UUID ids matching the entry id', () => {
    expect(rows).toHaveLength(61)
    expect(new Set(rows.map(r => r.id)).size).toBe(61)
    for (const row of rows) {
      expect(row.id).toMatch(UUID)
      expect(row.entry.id).toBe(row.id)
    }
  })

  it('activates 51 words as verified and keeps 10 hidden', () => {
    const active = rows.filter(r => r.active)
    expect(active).toHaveLength(51)
    expect(rows.filter(r => !r.active)).toHaveLength(10)
    for (const row of active) {
      expect(validateWord({ entry: row.entry, areas: row.areas, active: true }, row.id).issues, row.entry.headword).toEqual([])
      expect(row.entry.status).toBe('verified')
      expect(row.entry.variants.every((v: { status: string }) => v.status === 'verified')).toBe(true)
    }
    for (const row of rows.filter(r => !r.active)) {
      expect(validateWord({ entry: row.entry, areas: row.areas, active: false }, row.id).issues, row.entry.headword).toEqual([])
      expect(row.entry.status).toBe('placeholder')
    }
  })

  it('uses every word in Sveti Petar Orehovec with its area definitions', () => {
    for (const row of rows) {
      expect(row.entry.variants[0].form).toBe(row.entry.headword)
      for (const variant of row.entry.variants) {
        expect(variant.usages.map((u: { areaId: string }) => u.areaId)).toEqual(['hr-kkz-sveti-petar-orehovec'])
      }
      expect(row.areas.map((a: { id: string }) => a.id)).toEqual(['hr', 'hr-kkz', 'hr-kkz-sveti-petar-orehovec'])
    }
  })

  it('keeps source credits, proposes categories for active words only and invents no editorial text', () => {
    for (const row of rows) {
      expect(row.entry.sources).toHaveLength(1)
      expect(row.entry.sources[0].credit).toBeTruthy()
      expect(row.entry).not.toHaveProperty('examples')
      expect(row.entry).not.toHaveProperty('note')
      expect(row.entry).not.toHaveProperty('distractors')
      if (row.active) expect(DAILY_CATEGORIES).toContain(row.entry.category)
      else expect(row.entry).not.toHaveProperty('category')
    }
  })

  it('applies the reviewed corrections', () => {
    const by = (headword: string) => rows.find(r => r.entry.headword === headword)
    expect(by('krumper')).toMatchObject({ active: true, entry: { meaning: { hr: 'krumpir' }, category: 'food' } })
    expect(by('škrljak')?.entry.meaning).toEqual({ hr: 'šešir', en: 'hat' })
    expect(by('cukor')?.entry.meaning).toEqual({ hr: 'šećer', en: 'sugar' })
    expect(by('baba')?.entry.partOfSpeech).toBe('imenica')
    expect(by('fiškal')?.entry.sources[0].credit).toBe('Rječnik kajkavskog narječja – OŠ Jakovlje')
    expect(by('kruh')).toMatchObject({ active: false })
    expect(rows.some(r => r.entry.headword === 'hiža' && r.active)).toBe(true)
  })
})
