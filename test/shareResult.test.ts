import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resultCounts, resultEmojiRow, resultShareMessage } from '../app/utils/shareResult'

describe('resultShareMessage', () => {
  const results = [true, true, false, true, false]
  const message = resultShareMessage({
    headline: 'Kak se veli? · 3/5',
    results,
    invite: 'Možeš li bolje? Igraj i ti:',
    url: 'https://example.test/igre/kak-se-veli'
  })

  it('is the headline, one row of squares, an invitation and the link, each on its own line', () => {
    expect(message.split('\n')).toEqual([
      'Kak se veli? · 3/5',
      '🟩🟩🟥🟩🟥',
      'Možeš li bolje? Igraj i ti:',
      'https://example.test/igre/kak-se-veli'
    ])
  })

  it('reads the squares in question order, one per question', () => {
    expect(resultEmojiRow(results)).toBe('🟩🟩🟥🟩🟥')
    expect([...resultEmojiRow(results)]).toHaveLength(results.length)
  })

  it('uses 🟩 and 🟥 as the only emoji in the message', () => {
    const rest = message.replaceAll('🟩', '').replaceAll('🟥', '')
    expect(/\p{Extended_Pictographic}/u.test(rest)).toBe(false)
  })

  it('counts the squares for the text label', () => {
    expect(resultCounts(results)).toEqual({ ok: 3, no: 2 })
    expect(resultCounts([])).toEqual({ ok: 0, no: 0 })
  })
})

describe('og.svg', () => {
  const svg = readFileSync(new URL('../public/og.svg', import.meta.url), 'utf8')

  it('spells the Croatian text correctly', () => {
    expect(svg).toContain('Potkalnički zapisi')
    expect(svg).toContain('Priče, ljudi i baština')
    expect(svg).toContain('našega kraja')
    expect(svg).not.toContain('Potkalniki')
    expect(svg).not.toContain('�')
  })

  it('is a 1200×630 image on the deep sage ground', () => {
    expect(svg).toContain('viewBox="0 0 1200 630"')
    expect(svg).toContain('#374B40')
  })
})
