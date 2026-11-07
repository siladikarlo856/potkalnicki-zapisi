import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import Board from '../app/pages/potkalnicko-prigorje/izazov/[code]/ljestvica.vue'
import { usePzTabBar } from '../app/composables/usePzTabBar'
import type { ChallengeLeaderboard, ChallengeState } from '../shared/utils/challenge'

const code = 'boardproof12345678'
let closed = false
const snapshot = (): ChallengeState => ({
  code, title: { hr: 'Tko bolje zna naš kraj?', en: 'Who knows our corner better?' }, sample: false,
  createdAt: '2026-11-05T12:00:00Z', closesAt: '2026-11-12T12:00:00Z', closed,
  questionCount: 15, maxScore: 1500, targetScore: null,
  rounds: ['Riječi', 'Crkve', 'Zemljopis'].map(topic => ({ topic: { hr: topic, en: topic }, count: 5 })),
  participant: { nickname: 'Ivek', phase: 'finished', index: 15, total: 1300, completedAt: '2026-11-06T12:00:00Z', rounds: [] },
  question: null,
  feedback: null
})
const board: ChallengeLeaderboard = {
  count: 3,
  rows: [
    { nickname: 'Baka Mara', total: 1300, rank: 1, rounds: [500, 400, 400], completedAt: '2026-11-06T11:00:00Z' },
    { nickname: 'Ivek', total: 1300, rank: 1, rounds: [400, 500, 400], completedAt: '2026-11-06T12:00:00Z' },
    { nickname: 'Lucija', total: 800, rank: 3, rounds: [500, 300, 0], completedAt: null }
  ]
}
// The scoreboard lives at /leaderboard; the page must ask for exactly that path.
registerEndpoint(`/api/challenges/${code}/leaderboard`, () => board)
registerEndpoint(`/api/challenges/${code}`, () => snapshot())

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  closed = false
  expect(usePzTabBar().hidden.value).toBe(false)
})

async function mountBoard() {
  wrapper = await mountSuspended(Board, { route: `/potkalnicko-prigorje/izazov/${code}/ljestvica` })
  await expect.poll(() => wrapper!.find('table').exists()).toBe(true)
  return wrapper
}

describe('challenge leaderboard page', () => {
  it('lists the players in a table with th cells, ties as text ranks and the visitor\'s row marked', async () => {
    const page = await mountBoard()
    expect(page.get('h1').text()).toBe('Ljestvica')
    expect(page.findAll('thead th[scope="col"]')).toHaveLength(6)
    expect(page.findAll('[data-testid="challenge-rank"]').map(cell => cell.text().replace(/\s*\(.*\)$/, ''))).toEqual(['1', '1', '3'])
    expect(page.get('tr[data-me="true"]').text()).toContain('Ivek (ti)')
    expect(page.get('[data-testid="challenge-close-date"]').text()).toContain('Zatvara se 12. studenoga 2026.')
    expect(page.find('[data-testid="challenge-closed"]').exists()).toBe(false)
    // Open: the owner-or-finisher invites more friends from the sticky bar, and the tab bar steps aside.
    expect(page.get('[data-testid="challenge-board-primary"]').text()).toBe('Pozovi još prijatelja')
    expect(usePzTabBar().holds.value).toEqual(['challenge'])
  })

  it('keeps the table readable after closing and swaps the primary for "Napravi novi izazov"', async () => {
    closed = true
    const page = await mountBoard()
    expect(page.get('[data-testid="challenge-closed"]').text()).toContain('Izazov je zatvoren 12. studenoga 2026.')
    expect(page.findAll('tbody tr')).toHaveLength(3)
    expect(page.get('tbody').text()).toContain('Nije dovršeno')
    expect(page.find('[data-testid="challenge-close-date"]').exists()).toBe(false)
    const primary = page.get('[data-testid="challenge-board-primary"]')
    expect(primary.text()).toBe('Napravi novi izazov')
    expect(primary.attributes('href')).toBe('/potkalnicko-prigorje/izazov')
  })
})
