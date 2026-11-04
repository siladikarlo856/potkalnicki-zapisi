import { contentFold } from '../content/common'

const fold = (value: string) => contentFold(value).trim().replace(/\s+/g, ' ')

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const next = Math.min(row[j]! + 1, prev + 1, row[j - 1]! + cost)
      row[j - 1] = prev
      prev = next
    }
    row[b.length] = prev
  }
  return row[b.length]!
}

function firstMeaningSegment(meaning: string): string {
  const cut = meaning.split(/[,;(]/)[0]?.trim() ?? meaning.trim()
  return cut
}

export function transparency(headword: string, meaning: string): number {
  const a = fold(headword)
  const b = fold(firstMeaningSegment(meaning))
  const maxLen = Math.max(a.length, b.length, 1)
  const distance = levenshtein(a, b)
  return Math.round((1 - distance / maxLen) * 100) / 100
}

export function wordDifficulty(transparencyScore: number): 1 | 2 | 3 {
  if (transparencyScore >= 0.6) return 1
  if (transparencyScore >= 0.3) return 2
  return 3
}
