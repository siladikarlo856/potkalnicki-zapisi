import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import Board from '../app/pages/izazov/[code]/ljestvica.vue'
import Experience from '../app/components/heritage/ChallengeExperience.vue'
import { usePzTabBar } from '../app/composables/usePzTabBar'
import type { ChallengeLeaderboard, ChallengeState } from '../shared/utils/challenge'

const code = 'boardproof12345678'
let closed = false
let participantPresent = true
let shared = false
const snapshot = (): ChallengeState => ({
  code, title: { hr: 'Tko bolje zna naš kraj?', en: 'Who knows our corner better?' }, sample: false,
  createdAt: '2026-11-05T12:00:00Z', closesAt: '2026-11-12T12:00:00Z', closed,
  questionCount: 15, maxScore: 1500, targetScore: null,
  rounds: ['Riječi', 'Crkve', 'Zemljopis'].map(topic => ({ topic: { hr: topic, en: topic }, count: 5 })),
  participant: participantPresent ? { nickname: 'Ivek', phase: 'finished', index: 15, total: paginated ? 800 : 1300, completedAt: '2026-11-06T12:00:00Z', rounds: [] } : null,
  question: null,
  feedback: null
})
const board: ChallengeLeaderboard = {
  count: 3,
  completedCount: 2,
  me: { nickname: 'Ivek', total: 1300, rank: 1, rounds: [400, 500, 400], completedAt: '2026-11-06T12:00:00Z', sharedRank: true },
  rows: [
    { nickname: 'Baka Mara', total: 1300, rank: 1, rounds: [500, 400, 400], completedAt: '2026-11-06T11:00:00Z' },
    { nickname: 'Ivek', total: 1300, rank: 1, rounds: [400, 500, 400], completedAt: '2026-11-06T12:00:00Z' },
    { nickname: 'Lucija', total: 800, rank: 3, rounds: [500, 300, 0], completedAt: null }
  ]
}
// The scoreboard lives at /leaderboard; the page must ask for exactly that path.
let paginated = false
registerEndpoint(`/api/challenges/${code}/leaderboard`, (event) => {
  if (!paginated) return { ...board, me: participantPresent ? board.me : null }
  const { path } = event as unknown as { path: string }
  const offset = Number(new URL(path, 'http://localhost').searchParams.get('offset') ?? 0)
  const row = (index: number) => ({
    nickname: index === 50 ? 'Ivek' : `Igrač ${index}`,
    total: index < 50 ? 1300 : index === 50 || (shared && index === 51) ? 800 : 0,
    rank: index < 50 ? 1 : index === 50 || (shared && index === 51) ? 51 : shared ? 53 : 52,
    rounds: index < 50 ? [500, 400, 400] : index === 50 || (shared && index === 51) ? [400, 200, 200] : [0, 0, 0],
    completedAt: index < 60 ? '2026-11-06T12:00:00Z' : null
  })
  return {
    count: 70,
    completedCount: 60,
    me: participantPresent ? { ...row(50), sharedRank: shared } : null,
    rows: Array.from({ length: Math.min(50, 70 - offset) }, (_, index) => row(offset + index))
  }
})
registerEndpoint(`/api/challenges/${code}`, () => snapshot())
registerEndpoint(`/api/challenges/${code}/cards`, () => ({ cards: [] }))

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  closed = false
  paginated = false
  participantPresent = true
  shared = false
  expect(usePzTabBar().hidden.value).toBe(false)
})

async function mountBoard() {
  wrapper = await mountSuspended(Board, { route: `/izazov/${code}/ljestvica`, attachTo: document.body })
  await expect.poll(() => wrapper!.find('table').exists()).toBe(true)
  return wrapper
}

describe('challenge leaderboard page', () => {
  it('shows and shares a participant result beyond the first page before loading that row', async () => {
    paginated = true
    const page = await mountBoard()
    await expect.poll(() => page.find('[data-testid="challenge-place-title"]').text()).toBe('51. mjesto')
    expect(page.findAll('tbody tr')).toHaveLength(50)
    expect(page.find('tr[data-me="true"]').exists()).toBe(false)
    await page.get('[data-testid="challenge-leaderboard-share"]').trigger('click')
    await expect.poll(() => document.querySelector('[data-testid="pz-share-text"]')?.textContent).toContain('51. mjesto, 800 bodova.')
    const whatsapp = document.querySelector<HTMLAnchorElement>('[data-testid="challenge-leaderboard-whatsapp"]')!
    expect(new URL(whatsapp.href).searchParams.get('text')).toContain('51. mjesto, 800 bodova.')
  })

  it('shares only the leaderboard link for a visitor without a participant', async () => {
    paginated = true
    participantPresent = false
    const page = await mountBoard()
    expect(page.find('[data-testid="challenge-place-title"]').exists()).toBe(false)
    await page.get('[data-testid="challenge-leaderboard-share"]').trigger('click')
    await expect.poll(() => document.querySelector('[data-testid="pz-share-text"]')?.textContent).toContain(`/izazov/${code}/ljestvica/`)
    expect(document.querySelector('[data-testid="pz-share-text"]')!.textContent).not.toContain('mjesto')
  })

  it.each([false, true])('shows the finished participant result outside preview rows with sharedRank=%s', async (tied) => {
    paginated = true
    shared = tied
    wrapper = await mountSuspended(Experience, { props: { code }, route: `/izazov/${code}/` })
    await expect.poll(() => wrapper!.find('[data-testid="challenge-your-rank"]').text()).toBe(tied ? 'Dijeliš 51. mjesto.' : 'Tvoje mjesto: 51.')
    expect(wrapper.find('tr[data-me="true"]').exists()).toBe(false)
  })

  it('keeps the global completion count while loading more participant rows', async () => {
    paginated = true
    const page = await mountBoard()
    await expect.poll(() => page.find('[data-testid="challenge-played-count"]').text()).toBe('Odigralo 60 od 70')
    expect(page.findAll('tbody tr')).toHaveLength(50)
    const more = page.findAll('button').find(button => button.text() === 'Prikaži još')!
    await more.trigger('click')
    await expect.poll(() => page.findAll('tbody tr').length).toBe(70)
    await expect.poll(() => page.find('[data-testid="challenge-played-count"]').text()).toBe('Odigralo 60 od 70')
    expect(page.findAll('button').some(button => button.text() === 'Prikaži još')).toBe(false)
  })

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
    expect(primary.attributes('href')).toBe('/izazov/')
  })
})
