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
let pins = overview.pins
registerEndpoint('/api/review/daily', () => ({ ...overview, pins }))
registerEndpoint('/api/admin/lookup/word', () => ({ items: [] }))

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  pins = overview.pins
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

  it('pages the calendar by four weeks up to the pin horizon so a far pin can be reached and removed', async () => {
    // 2027-01-15 is 57 days after 2026-11-19; the window from Monday 2026-11-16 holding it starts 56 days later, on 2027-01-11.
    pins = [...overview.pins, { ...day(57, 'ganc') as object, day: '2027-01-15' } as never]
    wrapper = await mountSuspended({ setup: () => () => h(UApp, null, { default: () => h(RijecDana) }) }, { attachTo: document.body, route: '/admin/rijec-dana' })
    await vi.waitFor(() => expect(wrapper!.find('[data-test="daily-calendar"]').exists()).toBe(true))
    expect(wrapper.get('[data-test="daily-prev"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-test="daily-window-label"]').text()).toBe('16. 11. – 13. 12.')
    expect(wrapper.find('time[datetime="2027-01-15"]').exists()).toBe(false)

    expect(wrapper.get('[data-test="daily-coverage"]').text()).toContain('Prikvačeno do 15. siječnja 2027.')
    await wrapper.get('[data-test="daily-last-pin"]').trigger('click')
    await vi.waitFor(() => expect(wrapper!.get('[data-test="daily-window-label"]').text()).toBe('11. 1. – 7. 2.'))
    expect(wrapper.findAll('[data-test="daily-calendar"] li')).toHaveLength(28)
    expect(wrapper.find('button[aria-label="Ukloni prikvačenu riječ ganc za 2027-01-15"]').exists()).toBe(true)

    await wrapper.get('[data-test="daily-prev"]').trigger('click')
    await vi.waitFor(() => expect(wrapper!.get('[data-test="daily-window-label"]').text()).toBe('14. 12. – 10. 1.'))

    // The horizon is 366 days after today, 2027-11-20; the last window (Monday + 13 × 28 days) starts 2027-11-15.
    for (let step = 0; step < 20; step++) await wrapper.get('[data-test="daily-next"]').trigger('click')
    await vi.waitFor(() => expect(wrapper!.get('[data-test="daily-window-label"]').text()).toBe('15. 11. – 12. 12.'))
    expect(wrapper.get('[data-test="daily-next"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button[aria-label="Rasporedi riječ za 2027-11-20"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="Rasporedi riječ za 2027-11-21"]').exists()).toBe(false)
  })
})
