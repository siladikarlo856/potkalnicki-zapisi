import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData, clearNuxtState } from '#imports'
import Hub from '../app/pages/izazov/index.vue'
import Group from '../app/components/heritage/ChallengeHubGroup.vue'
import CodeField from '../app/components/pz/PzChallengeCodeField.vue'
import type { ChallengeState } from '../shared/utils/challenge'
import { decodeChallengeList, storedFromState } from '../shared/utils/challengeList'

const { navigateToMock } = vi.hoisted(() => ({ navigateToMock: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateToMock)

const code = 'aB3dEfGhIjK-_nO2'
const snapshot: ChallengeState = {
  code, title: { hr: 'Moj izazov', en: 'My challenge' }, sample: false,
  createdAt: '2026-11-19T12:00:00Z', closesAt: '2026-11-26T12:00:00Z', closed: false,
  questionCount: 10, maxScore: 1000, targetScore: null, rounds: [],
  participant: { nickname: 'Ana', phase: 'feedback', index: 0, total: 100, completedAt: null, rounds: [] },
  question: null, feedback: null
}
const lookups: string[] = []
registerEndpoint(`/api/challenges/${code}`, () => {
  lookups.push(code)
  return snapshot
})
registerEndpoint(`/api/challenges/${code.toUpperCase()}`, () => {
  lookups.push(code.toUpperCase())
  return Response.json({ statusMessage: 'Challenge not found' }, { status: 404 })
})

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
beforeEach(() => {
  localStorage.clear()
  clearNuxtState(['pz-challenge-list', 'pz-challenge-list-loaded', 'pz-challenge-leaderboard-counts'])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  clearNuxtData()
  lookups.length = 0
  navigateToMock.mockClear()
})

describe('challenge code entry', () => {
  it('describes the generated format and emits the exact case-sensitive input', async () => {
    wrapper = await mountSuspended(CodeField, { props: { modelValue: '' } })
    expect(wrapper.text()).toContain('16 znakova')
    expect(wrapper.text()).toContain('Velika i mala slova su važna.')
    const input = wrapper.get('input')
    expect(input.attributes('autocapitalize')).toBe('none')
    expect(input.attributes('placeholder')).toBe(`npr. ${code}`)
    await input.setValue(code)
    expect((input.element as HTMLInputElement).value).toBe(code)
    expect(wrapper.emitted('update:modelValue')).toEqual([[code]])
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('looks up and navigates to the code with its original capitalization', async () => {
    wrapper = await mountSuspended(Hub, { route: '/izazov/' })
    expect(wrapper.text()).toContain('16 znakova')
    expect(wrapper.text()).toContain('Velika i mala slova su važna.')
    await wrapper.get('input').setValue(` ${code} `)
    await wrapper.get('form').trigger('submit')
    await expect.poll(() => navigateToMock.mock.calls.length).toBe(1)
    expect(lookups).toEqual([code])
    expect(navigateToMock).toHaveBeenCalledWith(`/izazov/${code}/`)
  })

  it('reports a case-mismatched code as missing without navigating', async () => {
    wrapper = await mountSuspended(Hub, { route: '/izazov/' })
    await wrapper.get('input').setValue(code.toUpperCase())
    await wrapper.get('form').trigger('submit')
    await expect.poll(() => wrapper!.text()).toContain('Taj kôd ne postoji.')
    expect(lookups).toEqual([code.toUpperCase()])
    expect(navigateToMock).not.toHaveBeenCalled()
  })
})

describe('saved hub progress', () => {
  it.each([
    ['ready', 0, 0],
    ['question', 0, 0],
    ['feedback', 0, 1],
    ['question', 1, 1],
    ['feedback', 1, 2],
    ['round', 5, 5],
    ['feedback', 9, 10],
    ['feedback', 10, 10]
  ] as const)('shows %s at index %i as %i answered questions after restoring storage', async (phase, index, played) => {
    const saved = storedFromState({ ...snapshot, participant: { ...snapshot.participant!, phase, index } }, 'player')
    const restored = decodeChallengeList(JSON.stringify({ version: 1, items: [saved] }))
    wrapper = await mountSuspended(Group, { props: { items: restored.items, primaryAction: 'continue', newPlayersFor: () => 0 } })
    expect(wrapper.get('[data-testid="challenge-hub-row"]').text()).toContain(`odigralo ${played} od 10`)
  })

  it.each([false, true])('keeps the finished-date display when closed=%s', async (closed) => {
    const saved = storedFromState({ ...snapshot, closed, participant: { ...snapshot.participant!, phase: 'finished', index: 10, completedAt: '2026-11-19T12:01:00Z' } }, 'player')
    wrapper = await mountSuspended(Group, { props: { items: [saved], primaryAction: 'leaderboard', newPlayersFor: () => 0 } })
    expect(wrapper.text()).toContain('završio 19. studenoga 2026.')
    expect(wrapper.text()).not.toContain('odigralo')
  })
})
