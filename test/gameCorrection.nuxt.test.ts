import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from '#imports'
import Correction from '../app/components/games/Correction.vue'
import { registerAtlasApiEndpoints } from './helpers/registerAtlasApi'

registerAtlasApiEndpoints()

const CLUB_ID = '6b1d2c3e-4f50-4a61-8b72-9c83d4e5f601'
const SETTLEMENT_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'

registerEndpoint('/api/learn/pool', () => ({
  version: 1,
  generatedAt: '2026-11-04T00:00:00.000Z',
  cards: [{
    kind: 'club',
    key: `club:${CLUB_ID}`,
    id: CLUB_ID,
    topics: ['sport'],
    name: 'NK Potkalnik',
    slug: 'nk-potkalnik',
    sport: 'nogomet',
    settlementId: SETTLEMENT_ID,
    settlementName: 'Potkalnec',
    settlementSlug: 'potkalnec',
    municipalityId: SETTLEMENT_ID,
    seniorSeason: { season: '2025-26', seasonLabel: '2025./26.', competition: '1. ŽNL', team: 'NK Potkalnik' },
    verification: 'verified',
    difficulty: 2
  }],
  municipalities: [],
  settlements: [],
  topics: []
}))

const posted: Record<string, unknown>[] = []
registerEndpoint('/api/submissions', {
  method: 'POST',
  handler: async (event) => {
    posted.push(await (event as unknown as { web: { request: Request } }).web.request.json())
    return { ok: true }
  }
})

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  posted.length = 0
  clearNuxtData('card-pool')
})

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
const field = <T extends HTMLElement>(selector: string) => dialog()!.querySelector<T>(selector)!

describe('Correction on a game question', () => {
  it('corrects the club behind a club question, by its plain id', async () => {
    wrapper = await mountSuspended(Correction, { props: { card: `club:${CLUB_ID}:mjesto` }, attachTo: document.body })
    await wrapper.find('[data-testid="game-suggest"]').trigger('click')
    await vi.waitFor(() => expect(dialog()?.querySelector('[data-testid="suggest-form"]')).not.toBeNull())
    await vi.waitFor(() => expect(field<HTMLElement>('[data-testid="suggest-heading"]').textContent).toContain('NK Potkalnik'))
    await new Promise(resolve => setTimeout(resolve, 50))

    const name = field<HTMLInputElement>('input[name="p.name"]')
    expect(name.value).toBe('NK Potkalnik')
    name.value = 'NK Potkalnik Križevci'
    name.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    field<HTMLElement>('[role="checkbox"], input[type="checkbox"]').click()
    await nextTick()
    ;[...dialog()!.querySelectorAll('button')].find(item => item.textContent?.trim() === 'Pošalji')!.click()

    await vi.waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({
      type: 'correction',
      targetKind: 'club',
      targetId: CLUB_ID,
      payload: { name: 'NK Potkalnik Križevci' }
    })
  })
})
