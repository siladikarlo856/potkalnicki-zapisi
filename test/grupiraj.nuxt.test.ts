import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from '#imports'
import Grupiraj from '../app/pages/igre/grupiraj.vue'
import type { PoolWord } from '../shared/utils/learn/types'

const categories: PoolWord['category'][] = ['food', 'clothing', 'work', 'function', 'people', 'house']

const words: PoolWord[] = categories.flatMap(category =>
  [0, 1, 2, 3].map(i => ({
    kind: 'word' as const,
    key: `word:w-${category}-${i}`,
    id: `w-${category}-${i}`,
    headword: `${category}-${i}`,
    meaning: `${category}-${i}`,
    variants: [],
    status: 'verified' as const,
    category,
    topics: ['rijeci' as const],
    transparency: 0.5,
    difficulty: 2
  }))
)

registerEndpoint('/api/learn/pool', () => ({
  version: 1, generatedAt: '', cards: words, municipalities: [], settlements: [], topics: []
}))

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  clearNuxtData('card-pool')
})

type Page = NonNullable<typeof wrapper>

async function mountGame(): Promise<Page> {
  wrapper = await mountSuspended(Grupiraj, { route: '/igre/grupiraj/' })
  await expect.poll(() => wrapper!.findAll('[data-testid="grouping-tile"]').length, { timeout: 3000 }).toBe(16)
  return wrapper
}

const categoryOf = (label: string) => label.split('-')[0]

/** Picks four tiles with `pick` and submits them. */
async function guess(page: Page, pick: (tiles: string[]) => string[]) {
  const tiles = page.findAll('[data-testid="grouping-tile"]')
  const chosen = pick(tiles.map(t => t.text()))
  for (const label of chosen) {
    await tiles.find(t => t.text() === label)!.trigger('click')
  }
  await page.get('[data-testid="grouping-check"]').trigger('click')
}

/** One tile per category first, topped up with leftovers so it still has four tiles when only three groups remain. */
const wrongGuess = (tiles: string[]) => {
  const seen = new Set<string>()
  const firsts = tiles.filter((label) => {
    const category = categoryOf(label)
    if (seen.has(category)) return false
    seen.add(category)
    return true
  })
  return [...firsts, ...tiles.filter(label => !firsts.includes(label))].slice(0, 4)
}

const rightGuess = (tiles: string[]) => {
  const category = categoryOf(tiles[0]!)
  return tiles.filter(label => categoryOf(label) === category)
}

describe('grupiraj failed-state reveal', () => {
  it('reveals every group with its category and words once the attempts run out', async () => {
    const page = await mountGame()
    for (let i = 0; i < 4; i++) await guess(page, wrongGuess)

    expect(page.find('[data-testid="grouping-grid"]').exists()).toBe(false)
    expect(page.find('[data-testid="grouping-row-solved"]').exists()).toBe(false)
    const rows = page.findAll('[data-testid="grouping-row-revealed"]')
    expect(rows).toHaveLength(4)
    for (const row of rows) {
      // The category is a text label, not only a colour, and the row lists all four of its words.
      expect(row.text()).toContain('Otkriveno')
      const wordsInRow = row.findAll('p').at(-1)!.text().split(' · ')
      expect(wordsInRow).toHaveLength(4)
      expect(new Set(wordsInRow.map(categoryOf)).size).toBe(1)
      expect(row.classes().join(' ')).toMatch(/bg-(bukva-700|plava-600|oker-400|violet-600)/)
    }
    expect(new Set(rows.map(r => r.classes().find(c => c.startsWith('bg-')))).size).toBe(4)
    expect(page.get('[data-testid="grouping-result"]').text()).toContain('Ovaj put nije uspjelo')
  })

  it('keeps the groups the player solved apart from the ones revealed after failing', async () => {
    const page = await mountGame()
    await guess(page, rightGuess)
    expect(page.findAll('[data-testid="grouping-row-solved"]')).toHaveLength(1)
    for (let i = 0; i < 4; i++) await guess(page, wrongGuess)

    const solvedRow = page.get('[data-testid="grouping-row-solved"]')
    expect(solvedRow.text()).not.toContain('Otkriveno')
    expect(solvedRow.classes()).not.toContain('pz-group-reveal')
    const revealed = page.findAll('[data-testid="grouping-row-revealed"]')
    expect(revealed).toHaveLength(3)
    expect(revealed.every(r => r.classes().includes('pz-group-reveal'))).toBe(true)
    // Staggered one after another.
    expect(revealed.map(r => r.attributes('style'))).toEqual([
      expect.stringContaining('--reveal-i: 0'),
      expect.stringContaining('--reveal-i: 1'),
      expect.stringContaining('--reveal-i: 2')
    ])
  })

  it('offers no share on a loss, so the shared result never shows the revealed solution', async () => {
    const page = await mountGame()
    for (let i = 0; i < 4; i++) await guess(page, wrongGuess)
    const buttons = page.get('[data-testid="grouping-result"]').findAll('button').map(b => b.text())
    expect(buttons).not.toContain('Podijeli rezultat')
  })

  it('shows no revealed rows after a win and still offers sharing', async () => {
    const page = await mountGame()
    for (let i = 0; i < 4; i++) await guess(page, rightGuess)
    expect(page.findAll('[data-testid="grouping-row-solved"]')).toHaveLength(4)
    expect(page.find('[data-testid="grouping-row-revealed"]').exists()).toBe(false)
    const buttons = page.get('[data-testid="grouping-result"]').findAll('button').map(b => b.text())
    expect(buttons).toContain('Podijeli rezultat')
  })
})
