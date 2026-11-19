import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { UApp } from '#components'
import RijecDana from '../app/pages/admin/rijec-dana.vue'
import { addDays } from '../shared/utils/dailyWord'
import type { DailyAdminOverview } from '../shared/utils/dailyAdmin'

// The daily word scheduler (/admin/rijec-dana): a four-week calendar over the existing overview and pin endpoints.

const TODAY = '2026-11-19'
const day = (offset: number, headword: string) => ({ day: addDays(TODAY, offset), wordId: `w${offset}`, headword, village: 'auto', source: 'pinned' }) as never
const overview: DailyAdminOverview = {
  day: TODAY,
  today: { ...day(0, 'štenge') as object, source: 'auto' } as never,
  recent: [day(-1, 'bećar')],
  pins: [day(2, 'gablec'), day(5, 'lungomare')],
  runway: { readyUnused: 40, unused: 50, active: 90, daysLeft: 52 },
  warnings: []
}
registerEndpoint('/api/admin/session', () => ({ authenticated: true }))
registerEndpoint('/api/review/daily', () => overview)
registerEndpoint('/api/admin/lookup/word', () => ({ items: [] }))

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('admin daily word scheduler', () => {
  it('draws past, today, pinned and automatic days and states the coverage', async () => {
    wrapper = await mountSuspended({ setup: () => () => h(UApp, null, { default: () => h(RijecDana) }) }, { attachTo: document.body, route: '/admin/rijec-dana' })
    await vi.waitFor(() => expect(wrapper!.find('[data-test="daily-calendar"]').exists()).toBe(true))
    const cells = wrapper.findAll('[data-test="daily-calendar"] li')
    expect(cells).toHaveLength(28)
    expect(wrapper.get('[data-test="daily-coverage"]').text()).toContain('Prikvačeno do 24. studenoga 2026.')
    const kinds = new Set(cells.map(cell => cell.attributes('data-kind')))
    expect([...kinds].sort()).toEqual(['auto', 'past', 'pinned', 'today'])
    expect(wrapper.get('[data-kind="today"]').text()).toContain('štenge')
    expect(wrapper.text()).toContain('gablec')
  })

  it('opens the scheduling dialog from the primary action', async () => {
    wrapper = await mountSuspended({ setup: () => () => h(UApp, null, { default: () => h(RijecDana) }) }, { attachTo: document.body, route: '/admin/rijec-dana' })
    await vi.waitFor(() => expect(wrapper!.find('[data-test="daily-calendar"]').exists()).toBe(true))
    await wrapper.get('[data-test="daily-schedule"]').trigger('click')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Spremi u raspored'))
  })
})
