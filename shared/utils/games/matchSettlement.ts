import { contentFold } from '../content/common'

/** Accent-insensitive fold for settlement names (same rules as word difficulty). */
export function foldSettlementName(value: string): string {
  return contentFold(value).trim().replace(/\s+/g, ' ')
}

/** Expand common abbreviations before folding. */
export function normalizeSettlementInput(value: string): string {
  let text = value.trim()
  text = text.replace(/^sv\.\s+/i, 'sveti ')
  text = text.replace(/^sv\s+/i, 'sveti ')
  return text
}

/** Compare keys: folded text without spaces or hyphens. */
export function settlementMatchKey(value: string): string {
  return foldSettlementName(normalizeSettlementInput(value)).replace(/[-\s]/g, '')
}

/** Return the canonical settlement name when input matches exactly, otherwise null. */
export function matchSettlement(input: string, names: readonly string[]): string | null {
  const key = settlementMatchKey(input)
  if (!key) return null
  for (const name of names) {
    if (settlementMatchKey(name) === key) return name
  }
  return null
}

export function nabrojiTimerSeconds(settlementCount: number): number {
  const raw = 20 * settlementCount
  return Math.min(600, Math.max(90, raw))
}

export function formatTimerSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
