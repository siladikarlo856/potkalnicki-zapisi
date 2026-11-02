import type { WordEntry } from '../../app/types/heritage'

export type Random = () => number

/** A repeatable random source for tests; callers own the seed. */
export function seededRandom(seed: number): Random {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6D2B79F5) >>> 0
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffled<T>(items: readonly T[], random: Random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

function normalized(text: string) {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('hr')
}

function wordType(entry: WordEntry) {
  // Gender and other qualifiers do not make a noun a different part of speech.
  return normalized(entry.partOfSpeech?.split(',')[0] ?? '')
}

/** Prefer matching word types, then fill with distinct meanings. Without a locale,
 * both HR and EN (with HR fallback) must be unique. Quiz callers retain their
 * original display-locale uniqueness rule by passing a locale explicitly.
 */
export function pickDistractors(entry: WordEntry, pool: readonly WordEntry[], random: Random, count = 3, locale?: 'hr' | 'en', taken?: readonly { hr: string, en?: string }[]): WordEntry[] {
  if (count <= 0) return []
  const display = (word: WordEntry) => locale === 'hr' ? word.meaning.hr : word.meaning.en?.trim() || word.meaning.hr
  const meanings = new Set([normalized(display(entry))])
  const croatianMeanings = new Set([normalized(entry.meaning.hr)])
  for (const item of taken ?? []) {
    const hr = item.hr.trim()
    if (!hr) continue
    croatianMeanings.add(normalized(hr))
    meanings.add(normalized(locale === 'hr' ? hr : item.en?.trim() || hr))
  }
  const others = shuffled(pool.filter(word => word.id !== entry.id), random)
  const type = wordType(entry)
  const preferred = others.filter(word => type && wordType(word) === type)
  const fallback = others.filter(word => !type || wordType(word) !== type)
  const result: WordEntry[] = []
  for (const word of [...preferred, ...fallback]) {
    const key = normalized(display(word))
    const hrKey = normalized(word.meaning.hr)
    if (!key || meanings.has(key) || croatianMeanings.has(hrKey)) continue
    result.push(word)
    meanings.add(key)
    croatianMeanings.add(hrKey)
    if (result.length >= count) break
  }
  return result
}
