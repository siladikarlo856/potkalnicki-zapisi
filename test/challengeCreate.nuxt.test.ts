import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData, clearNuxtState, useRouter } from '#imports'
import CreateChallenge from '../app/pages/izazov/novi.vue'
import BottomNav from '../app/components/BottomNav.vue'
import { usePzTabBar } from '../app/composables/usePzTabBar'
import type { ChallengeSetPublic, ChallengeState, GenerateChallengeInput } from '../shared/utils/challenge'
import { computeTopicCounts } from '../shared/utils/learn/topics'
import { fixtureCardPool } from './fixtures/gamePool'

const { navigateToMock } = vi.hoisted(() => ({ navigateToMock: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateToMock)

const sets: ChallengeSetPublic[] = [
  {
    id: 'sample-template',
    title: { hr: 'Koliko poznaješ naš kraj?', en: 'How well do you know our region?' },
    sample: true,
    rounds: [{ topic: { hr: 'Riječi', en: 'Words' }, count: 5 }]
  },
  {
    id: 'ordinary-template',
    title: { hr: 'Riječi našega kraja', en: 'Words of our region' },
    sample: false,
    rounds: [{ topic: { hr: 'Riječi', en: 'Words' }, count: 5 }]
  }
]
const pool = fixtureCardPool()
for (let i = 0; i < 8; i++) {
  pool.cards.push({
    kind: 'club', key: `club:club-${i}`, id: `club-${i}`, topics: ['sport'],
    name: `NK ${i}`, slug: `nk-${i}`, sport: 'nogomet',
    settlementId: pool.settlements[i]!.id,
    settlementName: pool.settlements[i]!.name,
    settlementSlug: pool.settlements[i]!.slug,
    municipalityId: pool.settlements[i]!.municipalityId,
    seniorSeason: { season: '2026/27', seasonLabel: '2026./27.', competition: `Liga ${i}`, team: 'seniori' },
    verification: 'verified', difficulty: 2
  })
}
pool.topics = computeTopicCounts(pool.cards, pool.municipalities.map(m => ({ slug: m.slug, label: m.label })), new Map(pool.municipalities.map(m => [m.id, m.slug])))
registerEndpoint('/api/challenges/sets', () => sets)
registerEndpoint('/api/learn/pool', () => pool)
const createRequests: Array<{ nickname: string, generate: GenerateChallengeInput }> = []
const created: ChallengeState = {
  code: 'prefillproof12345', title: { hr: 'Moj izazov', en: 'My challenge' }, sample: false,
  createdAt: '2026-11-19T12:00:00Z', closesAt: '2026-11-26T12:00:00Z', closed: false,
  questionCount: 5, maxScore: 500, targetScore: null, rounds: [],
  participant: { nickname: 'Ana', phase: 'ready', index: 0, total: 0, completedAt: null, rounds: [] },
  question: null, feedback: null
}
registerEndpoint('/api/challenges', {
  method: 'POST',
  handler: async (event) => {
    const { web } = event as unknown as { web: { request: Request } }
    createRequests.push(await web.request.json())
    return created
  }
})

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
let navigation: Awaited<ReturnType<typeof mountSuspended>> | undefined
beforeEach(() => {
  localStorage.clear()
  clearNuxtState(['pz-challenge-list', 'pz-challenge-list-loaded', 'pz-challenge-leaderboard-counts'])
})
afterEach(async () => {
  wrapper?.unmount()
  wrapper = undefined
  navigation?.unmount()
  navigation = undefined
  expect(usePzTabBar().hidden.value).toBe(false)
  clearNuxtData()
  createRequests.length = 0
  navigateToMock.mockClear()
  await useRouter().replace({ query: {} })
})

describe('challenge create action bar', () => {
  it('keeps BottomNav hidden across nickname focus and blur, then restores it after leaving', async () => {
    navigation = await mountSuspended(BottomNav, { route: '/izazov/novi/' })
    expect(navigation.find('[data-testid="bottom-nav"]').exists()).toBe(true)
    wrapper = await mountSuspended(CreateChallenge, { route: '/izazov/novi/', attachTo: document.body })
    const { holds, hold, release } = usePzTabBar()
    expect(holds.value).toEqual(['challenge'])
    await expect.poll(() => navigation!.find('[data-testid="bottom-nav"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="challenge-create-submit"]').isVisible()).toBe(true)

    const nickname = wrapper.get('input[name="nickname"]').element as HTMLInputElement
    nickname.focus()
    await expect.poll(() => holds.value).toEqual(['challenge', 'keyboard'])
    nickname.blur()
    await expect.poll(() => holds.value).toEqual(['challenge'])
    expect(navigation.find('[data-testid="bottom-nav"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="challenge-create-submit"]').isVisible()).toBe(true)

    await wrapper.get('[data-testid="challenge-create-form"]').trigger('submit')
    expect(createRequests).toHaveLength(0)
    expect(navigation.find('[data-testid="bottom-nav"]').exists()).toBe(false)
    await wrapper.get('[data-testid="challenge-source-set"] input').setValue(true)
    expect(wrapper.find('[data-set-id]').exists()).toBe(true)
    expect(navigation.find('[data-testid="bottom-nav"]').exists()).toBe(false)

    hold('sheet')
    wrapper.unmount()
    wrapper = undefined
    expect(holds.value).toEqual(['sheet'])
    expect(navigation.find('[data-testid="bottom-nav"]').exists()).toBe(false)
    release('sheet')
    await expect.poll(() => navigation!.find('[data-testid="bottom-nav"]').exists()).toBe(true)
  })
})

describe('challenge template chooser', () => {
  it('discloses Sample templates with a visible, accessible label before and after selection', async () => {
    wrapper = await mountSuspended(CreateChallenge, { route: '/izazov/novi/' })
    await expect.poll(() => wrapper!.find('[data-testid="challenge-source-set"]').exists()).toBe(true)
    await wrapper.get('[data-testid="challenge-source-set"] input').setValue(true)

    const sample = wrapper.get('button[data-set-id="sample-template"]')
    const ordinary = wrapper.get('button[data-set-id="ordinary-template"]')
    const label = sample.get('[data-testid="sample-label"]')
    expect(label.text()).toBe('Uzorak')
    expect(label.isVisible()).toBe(true)
    expect(label.element.closest('[aria-hidden="true"], [hidden], [inert]')).toBeNull()
    expect(sample.attributes('aria-label')).toBeUndefined()
    expect(ordinary.find('[data-testid="sample-label"]').exists()).toBe(false)
    expect(sample.attributes('aria-pressed')).toBe('false')

    await sample.trigger('click')
    expect(sample.attributes('aria-pressed')).toBe('true')
    expect(sample.text()).toContain('Uzorak')
    expect(label.isVisible()).toBe(true)

    await ordinary.trigger('click')
    expect(ordinary.attributes('aria-pressed')).toBe('true')
    expect(sample.attributes('aria-pressed')).toBe('false')
    expect(sample.text()).toContain('Uzorak')
    expect(ordinary.text()).not.toContain('Uzorak')
  })
})

describe('challenge game prefill', () => {
  it.each([
    ['', ['karta-koje', 'znacenje', 'rijec']],
    ['?igra=karta-koje&teme=mjesta', ['znacenje', 'karta-koje', 'rijec']],
    ['?igra=osoba&teme=osobe', ['karta-koje', 'rijec', 'znacenje']]
  ] as const)('switches between word and map games from %s using the chosen game topics', async (query, games) => {
    wrapper = await mountSuspended(CreateChallenge, { route: `/izazov/novi/${query}` })
    for (const game of games) {
      const radio = wrapper.get(`input[name="game"][value="${game}"]`)
      await expect.poll(() => radio.attributes('disabled')).toBeUndefined()
      await radio.setValue(true)
      expect((radio.element as HTMLInputElement).checked).toBe(true)
      await wrapper.get('input[name="nickname"]').setValue('Ana')
      await wrapper.get('[data-testid="challenge-create-form"]').trigger('submit')
      await expect.poll(() => navigateToMock.mock.calls.length).toBe(1)
      expect(createRequests).toEqual([{ nickname: 'Ana', generate: { game, topics: [game === 'karta-koje' ? 'mjesta' : 'rijeci'], difficulty: 'srednje', length: 10 } }])
      createRequests.length = 0
      navigateToMock.mockClear()
    }
  })

  it('falls back to a compatible word game when the map pool becomes unavailable', async () => {
    wrapper = await mountSuspended(CreateChallenge, { route: '/izazov/novi/?igra=karta-koje&teme=mjesta' })
    await expect.poll(() => wrapper!.find('input[value="karta-koje"]:checked').exists()).toBe(true)
    const { useNuxtData } = await import('#imports')
    const { data } = useNuxtData<typeof pool>('card-pool')
    data.value = { ...pool, cards: pool.cards.filter(card => card.kind !== 'place') }
    await expect.poll(() => wrapper!.find('input[value="znacenje"]:checked').exists()).toBe(true)
    await wrapper.get('input[name="nickname"]').setValue('Ana')
    await wrapper.get('[data-testid="challenge-create-form"]').trigger('submit')
    await expect.poll(() => navigateToMock.mock.calls.length).toBe(1)
    expect(createRequests[0]?.generate).toMatchObject({ game: 'znacenje', topics: ['rijeci'] })
  })

  it('keeps the three default game choices when there is no incoming selection', async () => {
    wrapper = await mountSuspended(CreateChallenge, { route: '/izazov/novi/' })
    expect(wrapper.findAll('[data-game]').map(option => option.attributes('data-game'))).toEqual(['znacenje', 'rijec', 'karta-koje'])
  })

  it('updates the visible selection when incoming query parameters change', async () => {
    wrapper = await mountSuspended(CreateChallenge, { route: '/izazov/novi/?igra=osoba&teme=osobe' })
    for (const [game, topics] of [['osoba', 'osobe'], ['opcina', 'mjesta'], ['crkva', 'bastina']]) {
      await useRouter().replace({ query: { igra: game, teme: topics } })
      await expect.poll(() => wrapper!.find(`input[name="game"][value="${game}"]:checked`).exists()).toBe(true)
      expect(wrapper.get(`[data-game="${game}"]`).isVisible()).toBe(true)
      expect(wrapper.findAll('input[name="game"]:checked')).toHaveLength(1)
    }
  })

  it.each([
    ['znacenje', 'rijeci'],
    ['rijec', 'rijeci'],
    ['karta-koje', 'mjesta'],
    ['osoba', 'osobe'],
    ['opcina', 'mjesta'],
    ['crkva', 'bastina'],
    ['karta-tocke', 'mjesta'],
    ['klub-mjesto', 'sport'],
    ['klub-liga', 'sport'],
    ['klub-odakle', 'sport'],
    ['mjesovito', 'rijeci,mjesta,bastina,osobe,sport']
  ] as const)('shows the accepted %s selection and submits its original topics after reselection', async (game, topics) => {
    wrapper = await mountSuspended(CreateChallenge, { route: `/izazov/novi/?igra=${game}&teme=${topics}&tezina=lako&n=5` })
    await expect.poll(() => wrapper!.find(`input[name="game"][value="${game}"]:checked`).exists()).toBe(true)
    const option = wrapper.get(`[data-game="${game}"]`)
    expect(option.isVisible()).toBe(true)
    expect(option.get('b').text()).not.toBe('')
    const radio = option.get('input')
    expect(radio.attributes('disabled')).toBeUndefined()

    await wrapper.get('[data-testid="challenge-source-set"] input').setValue(true)
    await radio.setValue(true)
    expect(wrapper.find('[data-set-id]').exists()).toBe(false)
    expect(wrapper.findAll('input[name="game"]:checked')).toHaveLength(1)
    expect((radio.element as HTMLInputElement).checked).toBe(true)

    await wrapper.get('input[name="nickname"]').setValue('Ana')
    await wrapper.get('[data-testid="challenge-create-form"]').trigger('submit')
    await expect.poll(() => createRequests.length).toBe(1)
    expect(createRequests[0]).toEqual({ nickname: 'Ana', generate: { game, topics: topics.split(','), difficulty: 'lako', length: 5 } })
    await expect.poll(() => navigateToMock.mock.calls.length).toBe(1)
    expect(navigateToMock).toHaveBeenCalledWith(`/izazov/${created.code}/`)
  })
})
