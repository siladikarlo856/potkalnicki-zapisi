import { describe, expect, it } from 'vitest'
import { validateWord } from '../shared/utils/word'
import { dailyReadiness } from '../shared/utils/dailyWord'
import type { WordEntry } from '../app/types/heritage'

const base = { id: 'x', headword: 'x', meaning: { hr: 'značenje', en: 'meaning' }, partOfSpeech: 'imenica', status: 'community', sources: [{ id: 's', kind: 'editor' }], variants: [{ id: 'x-v1', form: 'x', status: 'community', usages: [] }] }
const check = (extra: Record<string, unknown>, active = true) => validateWord({ entry: { ...base, ...extra }, areas: [], active }, 'x')

describe('daily word fields', () => {
  it('omits the fields when absent so existing entries are unchanged', () => {
    const { value, issues } = check({})
    expect(issues).toEqual([])
    expect(value.entry).not.toHaveProperty('category')
    expect(value.entry).not.toHaveProperty('note')
    expect(value.entry).not.toHaveProperty('distractors')
  })

  it('projects valid category, note and distractors and trims text', () => {
    const { value, issues } = check({ category: 'house', note: { hr: '  Zanimljivost ', en: 'Fun fact', extra: 'x' }, distractors: [{ hr: ' kuća ', en: 'house', extra: 'x' }, { hr: 'put' }], bogus: 1 })
    expect(issues).toEqual([])
    expect(value.entry.category).toBe('house')
    expect(value.entry.note).toEqual({ hr: 'Zanimljivost', en: 'Fun fact' })
    expect(value.entry.distractors).toEqual([{ hr: 'kuća', en: 'house' }, { hr: 'put', en: undefined }])
    expect(value.entry).not.toHaveProperty('bogus')
  })

  it('treats an empty category and empty note as absent', () => {
    const { value, issues } = check({ category: '', note: { hr: '  ' } })
    expect(issues).toEqual([])
    expect(value.entry).not.toHaveProperty('category')
    expect(value.entry).not.toHaveProperty('note')
  })

  it('rejects an unknown category', () => {
    expect(check({ category: 'cars' }).issues).toContain('category: neispravna vrijednost')
  })

  it('enforces note limits and requires Croatian text with English', () => {
    expect(check({ note: { hr: 'a'.repeat(1000) } }).issues).toEqual([])
    expect(check({ note: { hr: 'a'.repeat(1001) } }).issues.length).toBeGreaterThan(0)
    expect(check({ note: { hr: 'ok', en: 'a'.repeat(1001) } }).issues.length).toBeGreaterThan(0)
    expect(check({ note: { en: 'only english' } }).issues.length).toBeGreaterThan(0)
  })

  it('enforces distractor count, length, and difference from the meaning and each other', () => {
    expect(check({ distractors: [{ hr: 'a' }, { hr: 'b' }, { hr: 'c' }] }).issues).toEqual([])
    expect(check({ distractors: [{ hr: 'a' }, { hr: 'b' }, { hr: 'c' }, { hr: 'd' }] }).issues.length).toBeGreaterThan(0)
    expect(check({ distractors: [{ hr: 'a'.repeat(201) }] }).issues.length).toBeGreaterThan(0)
    expect(check({ distractors: [{ hr: '' }] }).issues.length).toBeGreaterThan(0)
    expect(check({ distractors: [{ hr: '  ZNAČENJE ' }] }).issues.length).toBeGreaterThan(0)
    expect(check({ distractors: [{ hr: 'a', en: 'Meaning' }] }).issues.length).toBeGreaterThan(0)
    expect(check({ distractors: [{ hr: 'Kuća' }, { hr: ' kuća' }] }).issues.length).toBeGreaterThan(0)
    expect(check({ distractors: [{ hr: 'a', en: 'house' }, { hr: 'b', en: 'house' }, { hr: 'c' }] }).issues.length).toBeGreaterThan(0)
    expect(check({ distractors: [{ hr: 'meaning' }, { hr: 'a' }, { hr: 'b' }] }).issues.length).toBeGreaterThan(0)
    expect(check({ distractors: [{ hr: 'x', en: 'značenje' }, { hr: 'a' }, { hr: 'b' }] }).issues.length).toBeGreaterThan(0)
    expect(check({ distractors: [{ hr: 'foo', en: 'bar' }, { hr: 'bar', en: 'baz' }, { hr: 'qux' }] }).issues.length).toBeGreaterThan(0)
    expect(check({ distractors: 'nope' }).issues.length).toBeGreaterThan(0)
  })

  it('does not require the fields to activate a word', () => {
    expect(check({}, true).issues).toEqual([])
    expect(check({ category: 'cars' }, false).issues.length).toBeGreaterThan(0)
  })
})

describe('daily readiness', () => {
  const entry = (id: string, extra: Partial<WordEntry> = {}) => ({ ...base, id, meaning: { hr: `značenje ${id}` }, ...extra }) as unknown as WordEntry
  const pool = ['a', 'b', 'c', 'd'].map(id => entry(id))

  it('reports missing example, category and distractors', () => {
    expect(dailyReadiness(entry('w'), [entry('w')])).toMatchObject({ ready: false, missing: ['example', 'category', 'distractors'] })
  })

  it('is ready with an example, a category and enough automatic distractors', () => {
    const word = entry('w', { category: 'house', examples: [{ text: 'Primjer.' }] })
    expect(dailyReadiness(word, [word, ...pool])).toMatchObject({ ready: true, missing: [] })
  })

  it('counts hand-written distractors', () => {
    const word = entry('w', { category: 'house', examples: [{ text: 'Primjer.' }], distractors: [{ hr: '1' }, { hr: '2' }, { hr: '3' }] })
    expect(dailyReadiness(word, [word]).ready).toBe(true)
    expect(dailyReadiness({ ...word, distractors: [{ hr: '1' }] }, [word]).distractors).toBe(false)
  })

  it('ignores empty distractor slots when counting hand-written distractors', () => {
    const word = entry('w', { category: 'house', examples: [{ text: 'Primjer.' }] })
    expect(dailyReadiness({ ...word, distractors: [{ hr: '' }, { hr: '' }, { hr: '' }] }, [word]).distractors).toBe(false)
    expect(dailyReadiness({ ...word, distractors: [{ hr: '1' }, { hr: '' }, { hr: '' }] }, [word]).distractors).toBe(false)
  })

  it('ignores duplicate hand-written distractor slots', () => {
    const word = entry('w', { category: 'house', examples: [{ text: 'Primjer.' }] })
    expect(dailyReadiness({ ...word, distractors: [{ hr: 'a' }, { hr: ' A ' }, { hr: 'b' }] }, [word]).distractors).toBe(false)
    expect(dailyReadiness({ ...word, distractors: [{ hr: 'a', en: 'house' }, { hr: 'b', en: 'house' }, { hr: 'c' }] }, [word]).distractors).toBe(false)
  })

  it('does not count automatic picks that collide with hand-written meanings', () => {
    const word = entry('w', { category: 'house', examples: [{ text: 'Primjer.' }], distractors: [{ hr: 'značenje a' }] })
    const pool = [word, entry('a'), entry('b')]
    expect(dailyReadiness(word, pool).distractors).toBe(false)
  })

  it('rejects stored distractor rows that fail validation', () => {
    const word = entry('w', { category: 'house', examples: [{ text: 'Primjer.' }] })
    const largePool = [word, ...pool]
    const meaning = { hr: 'značenje', en: 'meaning' }
    const invalid: Partial<WordEntry>[] = [
      { distractors: [{ hr: '' }, { hr: '' }, { hr: '' }] },
      { meaning, distractors: [{ hr: 'značenje' }, { hr: 'a' }, { hr: 'b' }] },
      { meaning, distractors: [{ hr: 'meaning' }, { hr: 'a' }, { hr: 'b' }] },
      { meaning, distractors: [{ hr: 'x', en: 'značenje' }, { hr: 'a' }, { hr: 'b' }] },
      { distractors: [{ hr: 'foo', en: 'bar' }, { hr: 'bar', en: 'baz' }, { hr: 'qux' }] },
      { distractors: [{ hr: '1' }, { hr: '2' }, { hr: '3' }, { hr: '4' }] },
      { distractors: [{ hr: 'a'.repeat(201) }, { hr: 'b' }, { hr: 'c' }] },
      { distractors: [{ hr: 'a' }, { hr: ' A ' }, { hr: 'b' }] },
      { distractors: [{ hr: 'a', en: 'house' }, { hr: 'b', en: 'house' }, { hr: 'c' }] }
    ]
    for (const patch of invalid) {
      const candidate = { ...word, ...patch } as WordEntry
      expect(validateWord({ entry: candidate, areas: [], active: true }, 'w').issues.length).toBeGreaterThan(0)
      expect(dailyReadiness(candidate, largePool).distractors).toBe(false)
    }
  })

  it('rejects an invalid category for readiness', () => {
    const word = entry('w', { category: 'cars' as 'house', examples: [{ text: 'Primjer.' }] })
    expect(dailyReadiness(word, [word, ...pool]).category).toBe(false)
  })
})
