import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PzLeaderboard from '../app/components/pz/PzLeaderboard.vue'

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

// Listed out of order on purpose: the table sorts by rank, then finished before unfinished.
const rows = [
  { nickname: 'Lucija', total: 13, rank: 1, rounds: [5, 4, 4], completedAt: null },
  { nickname: 'Ivek', total: 13, rank: 1, rounds: [4, 5, 4], completedAt: '2026-11-07T10:00:00Z' },
  { nickname: 'Baka Mara', total: 8, rank: 3, rounds: [5, 3, 0], completedAt: '2026-11-07T09:00:00Z' },
  { nickname: 'Tomo s Kalnika', total: 2, rank: 4, rounds: [2], completedAt: null }
]

async function mountBoard(props: Record<string, unknown> = {}) {
  wrapper = await mountSuspended(PzLeaderboard, { props: { rows, roundCount: 3, me: 'Ivek', ...props } })
  return wrapper
}

describe('PzLeaderboard', () => {
  it('is a real table whose header cells are th with scope="col"', async () => {
    const board = await mountBoard()
    expect(board.element.tagName).toBe('TABLE')
    const headers = board.findAll('thead th')
    expect(headers.map(th => th.attributes('scope'))).toEqual(Array(6).fill('col'))
    expect(headers.map(th => th.text())).toEqual(['#', 'Igrač', 'R1Runda 1', 'R2Runda 2', 'R3Runda 3', 'ΣUkupno'])
    expect(board.find('caption').exists()).toBe(true)
    // Each nickname is the row header, so a screen reader reads it with every cell of its row.
    expect(board.findAll('tbody th[scope="row"]')).toHaveLength(rows.length)
  })

  it('shows ranks as text, ties sharing a rank and the next rank skipping (1, 1, 3, 4)', async () => {
    const board = await mountBoard()
    const ranks = board.findAll('[data-testid="challenge-rank"]').map(cell => cell.text().replace(/\s*\(.*\)$/, ''))
    expect(ranks).toEqual(['1', '1', '3', '4'])
    // A tie says so in words as well, never by the number alone.
    const tied = board.findAll('[data-testid="challenge-rank"]').map(cell => cell.text().includes('dijeli mjesto'))
    expect(tied).toEqual([true, true, false, false])
  })

  it('sorts by rank, then finished before unfinished, and marks the visitor\'s own row', async () => {
    const board = await mountBoard()
    const order = board.findAll('tbody tr').map(row => row.find('th b').text())
    expect(order).toEqual(['Ivek', 'Lucija', 'Baka Mara', 'Tomo s Kalnika'])
    const mine = board.findAll('tbody tr').filter(row => row.attributes('data-me') === 'true')
    expect(mine).toHaveLength(1)
    expect(mine[0]!.text()).toContain('Ivek (ti)')
    expect(board.findAll('tbody tr')[1]!.text()).not.toContain('(ti)')
  })

  it('gives each row a status in words and a dash for unplayed rounds', async () => {
    const board = await mountBoard()
    const text = (name: string) => board.findAll('tbody tr').find(row => row.find('th b').text() === name)!.text()
    expect(text('Ivek')).toContain('Završeno')
    expect(text('Lucija')).toContain('U tijeku')
    expect(text('Tomo s Kalnika')).toContain('U tijeku')
    expect(text('Tomo s Kalnika')).toContain('–')
    const closed = await mountBoard({ closed: true })
    expect(closed.findAll('tbody tr')[3]!.text()).toContain('Nije dovršeno')
  })

  it('reads unplayed rounds as dashes for a player still playing, and keeps a finished player\'s zero', async () => {
    const board = await mountBoard({
      rows: [
        { nickname: 'Lucija', total: 8, rank: 1, rounds: [5, 3, 0], completedAt: null },
        { nickname: 'Ivek', total: 5, rank: 2, rounds: [5, 0, 0], completedAt: '2026-11-07T10:00:00Z' }
      ]
    })
    const cells = (name: string) => board.findAll('tbody tr').find(row => row.find('th b').text() === name)!.findAll('td').map(td => td.text())
    expect(cells('Lucija')).toEqual(['1', '5', '3', '–', '8'])
    expect(cells('Ivek')).toEqual(['2', '5', '0', '0', '5'])
  })
})
