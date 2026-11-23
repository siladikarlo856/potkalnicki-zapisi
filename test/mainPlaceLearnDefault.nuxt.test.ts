import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { clearNuxtData, clearNuxtState, useState } from '#imports'
import { LEARN_STORAGE_KEY } from '../app/composables/useLearnState'
import { PROGRESS_STORAGE_KEY } from '../app/composables/useProgress'
import type { CardPool } from '../shared/utils/learn/types'
import type { CardProgress } from '../shared/utils/learn/leitner'
import type { MainPlacePreference } from '../server/utils/accountMainPlace'
import LearnSetup from '../app/pages/uci/index.vue'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
mockNuxtImport('$fetch', () => fetchMock)

const pool: CardPool = {
  version: 1, generatedAt: '', municipalities: [{ id: 'mun-1', slug: 'grad-krizevci', name: 'Grad Križevci', label: 'Grad Križevci', kind: 'town' }],
  settlements: [
    { id: 'c9731a87-1dee-807a-94ed-83d47b96fad2', slug: 'apatovec', name: 'Apatovec', municipalityId: 'mun-1' },
    { id: 'second', slug: 'drugo', name: 'Drugo', municipalityId: 'mun-1' }
  ],
  cards: [
    { kind: 'word', key: 'word:fresh', id: 'fresh', topics: ['rijeci'], headword: 'hiža', meaning: 'kuća', variants: [], status: 'verified', transparency: 0.5, difficulty: 2 }
  ],
  topics: [{ id: 'rijeci', label: 'Riječi', status: 'live', count: 1 }]
}

const place = { id: 'c9731a87-1dee-807a-94ed-83d47b96fad2', name: 'Apatovec', municipality: 'Grad Križevci', county: 'KKŽ' }
const secondPlace = { ...place, id: 'second', name: 'Drugo' }
const preference: MainPlacePreference = { mainPlaceId: place.id, place, archivedNote: null }
const card = (): CardProgress => ({ box: 2, due: '2026-11-18', seen: 1, known: 1, missed: 0, lastPlayed: '2026-11-18' })
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined

function signedIn() {
  useState('pz-auth-session').value = {
    access_token: 'access-token',
    refresh_token: 'x',
    expires_in: 3600,
    expires_at: 1_900_000_000,
    token_type: 'bearer',
    user: { id: 'user-1', email: 'igrač@example.com' }
  }
  useState('pz-auth-session-initialized').value = true
}

function rememberPlace(place: string) {
  localStorage.setItem(LEARN_STORAGE_KEY, JSON.stringify({ version: 1, current: null, lastTopics: ['rijeci'], lastN: 10, place }))
}

function selectedPlace() {
  const link = wrapper!.get('[data-testid="learn-home-review"], [data-testid="learn-home-new-lesson"], [data-testid="learn-setup-start"]')
  return new URL(link.attributes('href')!, 'https://example.test').searchParams.get('mjesto')
}

function storedPlace() {
  return JSON.parse(localStorage.getItem(LEARN_STORAGE_KEY) ?? '{}').place
}

function accountRequests() {
  return fetchMock.mock.calls.filter(([url]) => url === '/api/account/main-place')
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-19T12:00:00'))
  fetchMock.mockReset()
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/learn/pool') return Promise.resolve(pool)
    if (url === '/api/account/main-place') return Promise.resolve(preference)
    if (url === '/api/places') return Promise.resolve({ places: [secondPlace] })
    return Promise.reject(new Error(url))
  })
  clearNuxtState(key => key.startsWith('pz-') || key.startsWith('heritage-progress'))
  clearNuxtData('card-pool')
  localStorage.clear()
  localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, cards: { 'word:fresh': card() }, lastPlayed: '2026-11-18', streak: 1 }))
  useState('pz-auth-session-initialized').value = true
  useState('pz-supabase-client').value = {}
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('/uci main place default', () => {
  it('uses the account preference without persisting it as the device-local choice', async () => {
    signedIn()
    wrapper = await mountSuspended(LearnSetup, { route: '/uci/' })
    await expect.poll(selectedPlace).toBe('apatovec')
    expect(wrapper.get<HTMLInputElement>('[role="combobox"]').element.value).toBe('Apatovec')
    expect(storedPlace()).toBeUndefined()
  })

  it('keeps an anonymous device-local place without using the account API', async () => {
    rememberPlace('drugo')
    wrapper = await mountSuspended(LearnSetup, { route: '/uci/' })
    await expect.poll(selectedPlace).toBe('drugo')
    expect(accountRequests()).toHaveLength(0)
    expect(storedPlace()).toBe('drugo')
    await wrapper.get('[data-testid="learn-place"] button').trigger('click')
    await expect.poll(selectedPlace).toBeNull()
    expect(storedPlace()).toBeUndefined()
  })

  it.each([undefined, 'drugo'])('restores the device-local choice %s after sign-out', async (devicePlace) => {
    if (devicePlace) rememberPlace(devicePlace)
    signedIn()
    wrapper = await mountSuspended(LearnSetup, { route: '/uci/' })
    await expect.poll(selectedPlace).toBe('apatovec')
    expect(storedPlace()).toBe(devicePlace)
    useState('pz-auth-session').value = null
    await expect.poll(selectedPlace).toBe(devicePlace ?? null)
    expect(wrapper.get<HTMLInputElement>('[role="combobox"]').element.value).toBe(devicePlace ? 'Drugo' : '')
    expect(storedPlace()).toBe(devicePlace)
  })

  it.each(['picker', 'change', 'setup'])('keeps an explicit clear through the %s control', async (control) => {
    signedIn()
    if (control === 'setup') localStorage.removeItem(PROGRESS_STORAGE_KEY)
    wrapper = await mountSuspended(LearnSetup, { route: '/uci/' })
    await expect.poll(selectedPlace).toBe('apatovec')
    if (control === 'setup') await wrapper.get('input[value="mjesto"]').setValue()
    const buttons = wrapper.findAll('[data-testid="learn-place"] button')
    await buttons[control === 'change' ? buttons.length - 1 : 0]!.trigger('click')
    await expect.poll(selectedPlace).toBeNull()
    expect(wrapper.get<HTMLInputElement>('[role="combobox"]').element.value).toBe('')
    expect(storedPlace()).toBeUndefined()
    signedIn()
    await wrapper.vm.$nextTick()
    expect(selectedPlace()).toBeNull()
    expect(accountRequests()).toHaveLength(1)
  })

  it('keeps an explicit picker change after sign-out', async () => {
    signedIn()
    wrapper = await mountSuspended(LearnSetup, { route: '/uci/' })
    await expect.poll(selectedPlace).toBe('apatovec')
    await wrapper.get('[role="combobox"]').setValue('Drugo')
    await expect.poll(() => wrapper!.find('[role="option"]').exists()).toBe(true)
    await wrapper.get('[role="option"]').trigger('click')
    await expect.poll(selectedPlace).toBe('drugo')
    expect(storedPlace()).toBe('drugo')
    useState('pz-auth-session').value = null
    await wrapper.vm.$nextTick()
    expect(selectedPlace()).toBe('drugo')
  })

  it('honors a route place over the account and device-local defaults', async () => {
    rememberPlace('apatovec')
    signedIn()
    wrapper = await mountSuspended(LearnSetup, { route: '/uci/?mjesto=drugo' })
    await expect.poll(selectedPlace).toBe('drugo')
    expect(accountRequests()).toHaveLength(0)
    expect(storedPlace()).toBe('apatovec')
    useState('pz-auth-session').value = null
    await wrapper.vm.$nextTick()
    expect(selectedPlace()).toBe('drugo')
  })

  it.each(['clear', 'sign-out'])('discards a pending account default after %s', async (action) => {
    rememberPlace('drugo')
    signedIn()
    let resolvePreference!: (value: MainPlacePreference) => void
    const pending = new Promise<MainPlacePreference>((resolve) => {
      resolvePreference = resolve
    })
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/learn/pool') return Promise.resolve(pool)
      if (url === '/api/account/main-place') return pending
      return Promise.reject(new Error(url))
    })
    wrapper = await mountSuspended(LearnSetup, { route: '/uci/' })
    await expect.poll(() => accountRequests().length).toBe(1)
    if (action === 'clear') await wrapper.get('[data-testid="learn-place"] button').trigger('click')
    else useState('pz-auth-session').value = null
    await wrapper.vm.$nextTick()
    resolvePreference(preference)
    await pending
    await wrapper.vm.$nextTick()
    expect(selectedPlace()).toBe(action === 'clear' ? null : 'drugo')
    expect(wrapper.get<HTMLInputElement>('[role="combobox"]').element.value).toBe(action === 'clear' ? '' : 'Drugo')
    expect(storedPlace()).toBe(action === 'clear' ? undefined : 'drugo')
  })
})
