import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { UApp } from '#components'
import AdminIntangibleWhen from '../app/components/admin/IntangibleWhen.vue'
import Narrators from '../app/pages/admin/kazivaci.vue'
import Stories from '../app/pages/admin/price.vue'
import Prijedlozi from '../app/pages/admin/prijedlozi.vue'
import { ADMIN_NAV } from '../app/utils/adminNav'
import type { InboxRow } from '../shared/types/inbox'
import type { Narrator } from '../shared/utils/content/narrator'
import type { Story } from '../shared/utils/content/story'

// The admin pages for Stories, Narrators and the Memory → Draft action, against mocked API routes.

const STORY = '6f1c1c36-3a5e-4b7f-9a52-0d3f0b6c1a10'
const TYPE = '0a4f3d2e-8b1c-4d5e-9f60-718293a4b5c6'
const NARRATOR = '2c7d6a10-5b34-4e0e-8a2c-9d1f3e4b5a60'
const AREA = '3d8e7b21-6c45-4f1f-9b3d-0e2a4f5c6b71'
const SOURCE_A = '11111111-1111-4111-8111-111111111111'
const SOURCE_B = '22222222-2222-4222-8222-222222222222'

const { navigateToMock } = vi.hoisted(() => ({ navigateToMock: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateToMock)

type WebEvent = { method: string, path: string, web: { request: Request } }
const calls: Array<{ method: string, path: string, query: Record<string, string>, body?: unknown }> = []
async function record(event: unknown, withBody = false) {
  const { method, path, web } = event as WebEvent
  const url = new URL(path.replace(/^\/_/, ''), 'http://localhost')
  const body = withBody ? await web.request.json() : undefined
  calls.push({ method, path: url.pathname, query: Object.fromEntries(url.searchParams), body })
  return body
}

const story: Story = {
  id: STORY, status: 'published', revision: 3, createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z',
  title: 'Bela Kata', slug: 'bela-kata', typeId: TYPE, typeLabel: 'Bajka', placesLabel: 'Gornji Fodrovec',
  textLocal: 'Bila je jena…', textStandard: null, period: 'do šezdesetih', periodUnit: 'decade', periodValue: 1960,
  recordedPrecision: 'month', recordedYear: 1984, recordedMonth: 3, recordedDay: null,
  verification: 'in_review', researchNotes: '', noindex: false,
  areaLinks: [{ areaId: AREA, relation: 'recorded_in' }, { areaId: AREA, relation: 'about' }],
  narrators: [{ narratorId: NARRATOR, role: 'narrator' }],
  authorIds: [], itemIds: [], themeIds: [], sourceIds: [SOURCE_A, SOURCE_B]
}
const narrators: Narrator[] = [
  {
    id: NARRATOR, status: 'published', revision: 1, createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z',
    name: 'Marija Horvat', slug: 'kazivacica-1938', publicDescription: 'kazivačica, r. 1938., Gornji Fodrovec', consentNamed: false, consentNote: null,
    living: true, bornYear: 1938, settlementId: null, personId: null, verification: 'unverified', researchNotes: '', noindex: false, settlementLabel: null, personLabel: null
  },
  {
    id: '4e9f8c32-7d56-4a2a-8c4e-1f3b5a6d7c82', status: 'published', revision: 1, createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z',
    name: 'Ivan Kovač', slug: 'ivan-kovac', publicDescription: null, consentNamed: true, consentNote: 'usmeno, 2026.',
    living: false, bornYear: 1921, settlementId: null, personId: null, verification: 'verified', researchNotes: '', noindex: false, settlementLabel: null, personLabel: null
  }
]
const lookups: Record<string, Array<{ id: string, label: string, status: 'published' | 'draft' | 'archived' }>> = {
  area: [{ id: AREA, label: 'Gornji Fodrovec · Naselje', status: 'published' }],
  narrator: [{ id: NARRATOR, label: 'Marija Horvat', status: 'published' }],
  source: [{ id: SOURCE_A, label: 'Rukopis župnika', status: 'published' }, { id: SOURCE_B, label: 'Snimka 2026.', status: 'draft' }]
}
const memory: InboxRow = {
  id: 15, type: 'memory', text: 'Na Martinje smo pekli kestenje.', targetKind: null, targetId: null, payload: null, baseRevision: null, wordId: null, intent: null,
  wordHeadword: null, place: null, placeId: null, placeCatalogVersion: null, placeContext: null, name: 'Ana Horvat', contact: null, consentPublish: true,
  consentVersion: '2026-11-02', locale: 'hr', status: 'pending', createdAt: '2026-11-02 10:00:00', reviewedAt: null, appliedAt: null, appliedEntityId: null,
  target: null, created: null, canDraft: true
}
let inboxRows: InboxRow[] = [memory]

registerEndpoint('/api/admin/session', () => ({ authenticated: true }))
registerEndpoint('/api/admin/content/story', {
  method: 'GET',
  handler: (event) => {
    record(event)
    return { rows: [story], total: 1, page: 1, size: 25 }
  }
})
registerEndpoint('/api/admin/content/story_type', (event) => {
  record(event)
  return { rows: [{ id: TYPE, key: 'bajka', labelHr: 'Bajka', labelEn: null, sort: 1, status: 'published', revision: 1, createdAt: '', updatedAt: '' }], total: 1, page: 1, size: 100 }
})
registerEndpoint(`/api/admin/content/story/${STORY}`, { method: 'GET', handler: () => ({ entity: story, legacyIds: [] }) })
registerEndpoint(`/api/admin/content/story/${STORY}`, {
  method: 'PATCH',
  handler: async (event) => {
    const body = await record(event, true) as { revision: number }
    return { entity: { ...story, ...body, revision: body.revision + 1 } }
  }
})
registerEndpoint('/api/admin/content/narrator', {
  method: 'GET',
  handler: (event) => {
    record(event)
    return { rows: narrators, total: narrators.length, page: 1, size: 25 }
  }
})
for (const kind of Object.keys(lookups)) {
  registerEndpoint(`/api/admin/lookup/${kind}`, (event) => {
    record(event)
    const ids = new URL((event as WebEvent).path.replace(/^\/_/, ''), 'http://localhost').searchParams.get('ids')?.split(',')
    return { items: ids ? lookups[kind]!.filter(item => ids.includes(item.id)) : lookups[kind] }
  })
}
registerEndpoint('/api/admin/inbox', () => ({ rows: inboxRows, total: inboxRows.length, page: 1, size: 25, counts: { pending: 1 } }))
registerEndpoint('/api/admin/inbox/summary', () => ({ pending: 1 }))
registerEndpoint('/api/admin/inbox/15', () => ({ submission: inboxRows[0], changes: [], patch: null, stale: false }))

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(async () => {
  wrapper?.unmount()
  wrapper = undefined
  calls.length = 0
  navigateToMock.mockClear()
  inboxRows = [memory]
  await useRouter().replace({ query: {} })
})

function mountInApp(component: unknown, route: string, props: Record<string, unknown> = {}) {
  return mountSuspended({ setup: () => () => h(UApp, null, { default: () => h(component as never, props) }) }, { attachTo: document.body, route })
}
const dialogs = () => [...document.body.querySelectorAll<HTMLElement>('[role="dialog"]')]
const dialog = () => dialogs().at(-1)
const buttonIn = (root: ParentNode | undefined, label: string) =>
  [...(root?.querySelectorAll('button') ?? [])].find(item => item.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined
async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

describe('admin navigation', () => {
  it('lists the new pages with their Croatian names', () => {
    const entries = Object.fromEntries(ADMIN_NAV.map(item => [item.label, item.to]))
    expect(entries).toMatchObject({
      'Priče': '/admin/price', 'Običaji': '/admin/obicaji', 'Usmeni tekstovi': '/admin/usmeni-tekstovi', 'Kazivači': '/admin/kazivaci',
      'Vrste priča': '/admin/vrste-prica', 'Vrste običaja': '/admin/vrste-obicaja', 'Vrste usmenih tekstova': '/admin/vrste-usmenih-tekstova',
      'Prigode': '/admin/prigode', 'Teme': '/admin/teme'
    })
  })
})

describe('admin Priče', () => {
  it('lists stories with type, places and the date as far as it is known', async () => {
    wrapper = await mountInApp(Stories, '/admin/price')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Bela Kata'))
    expect(wrapper.text()).toContain('Bajka')
    expect(wrapper.text()).toContain('Gornji Fodrovec')
    expect(wrapper.text()).toContain('ožujak 1984.')
    expect(wrapper.text()).toContain('U provjeri')
    expect(calls.find(call => call.path === '/api/admin/content/story')?.query).toMatchObject({ sort: 'title' })
  })

  it('opens a story with every link in its saved order and saves a reordered source list with the revision', async () => {
    wrapper = await mountInApp(Stories, `/admin/price?uredi=${STORY}`)
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Rukopis župnika'))
    const text = dialog()!.textContent!
    // Both place groups, the narrator with a role, the sources in order, the attestation explained.
    expect(text).toContain('Zabilježeno u')
    expect(text).toContain('Odnosi se na')
    expect(text).toContain('Marija Horvat')
    expect(text).toContain('Snimka 2026. (skica)')
    expect(text.indexOf('Rukopis župnika')).toBeLessThan(text.indexOf('Snimka 2026.'))
    expect(text).toContain('Nikad ne priječi objavu')
    expect(dialog()!.querySelector<HTMLInputElement>('[data-test="admin-recorded-year"]')?.value).toBe('1984')
    expect(dialog()!.querySelector('[data-test="admin-recorded-day"]')).toBeNull()

    buttonIn(dialog(), 'Spremi')!.click()
    await vi.waitFor(() => expect(calls.find(call => call.method === 'PATCH')).toBeDefined())
    expect(calls.find(call => call.method === 'PATCH')?.body).toMatchObject({
      title: 'Bela Kata', typeId: TYPE, status: 'published', revision: 3, sourceIds: [SOURCE_A, SOURCE_B],
      recordedPrecision: 'month', recordedYear: 1984, recordedMonth: 3, recordedDay: null,
      periodUnit: 'decade', periodValue: 1960, narrators: [{ narratorId: NARRATOR, role: 'narrator' }],
      areaLinks: [{ areaId: AREA, relation: 'recorded_in' }, { areaId: AREA, relation: 'about' }]
    })

    // The same dialog, with the first source moved down: the order is what is saved.
    await vi.waitFor(() => expect(useRoute().query.uredi).toBeUndefined())
    calls.length = 0
    await useRouter().replace({ query: { uredi: STORY } })
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Rukopis župnika'))
    dialog()!.querySelector<HTMLButtonElement>('button[aria-label^="Pomakni izvor dolje: Rukopis"]')!.click()
    await vi.waitFor(() => expect(dialog()!.textContent!.indexOf('Snimka 2026.')).toBeLessThan(dialog()!.textContent!.indexOf('Rukopis župnika')))
    buttonIn(dialog(), 'Spremi')!.click()
    await vi.waitFor(() => expect(calls.find(call => call.method === 'PATCH')?.body).toMatchObject({ sourceIds: [SOURCE_B, SOURCE_A] }))
  })

  it('asks for a title and a type before sending a new story', async () => {
    wrapper = await mountInApp(Stories, '/admin/price?novo=1')
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Nova priča'))
    buttonIn(dialog(), 'Spremi skicu')!.click()
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Polje „Naslov“ je obavezno.'))
    expect(dialog()?.textContent).toContain('Odaberite vrstu priče.')
    expect(calls.filter(call => call.method === 'POST')).toEqual([])
  })
})

describe('date editor', () => {
  const state = { recordedPrecision: null, recordedYear: null, recordedMonth: null, recordedDay: null }
  const mountWhen = (overrides: Record<string, unknown>) => mountSuspended(AdminIntangibleWhen, { props: { state: { ...state, ...overrides }, periodLabel: 'Vrijeme radnje' } })

  it('shows only the parts that are known: nothing, the year, the month or the day', async () => {
    const none = await mountWhen({})
    expect(none.find('[data-test="admin-recorded-year"]').exists()).toBe(false)
    const year = await mountWhen({ recordedPrecision: 'year', recordedYear: 1984 })
    expect(year.find('[data-test="admin-recorded-year"]').exists()).toBe(true)
    expect(year.find('[data-test="admin-recorded-month"]').exists()).toBe(false)
    const month = await mountWhen({ recordedPrecision: 'month', recordedYear: 1984, recordedMonth: 3 })
    expect(month.find('[data-test="admin-recorded-month"]').exists()).toBe(true)
    expect(month.find('[data-test="admin-recorded-day"]').exists()).toBe(false)
    const day = await mountWhen({ recordedPrecision: 'day', recordedYear: 1984, recordedMonth: 3, recordedDay: 12 })
    expect(day.find('[data-test="admin-recorded-day"]').exists()).toBe(true)
  })

  it('asks for the value of an approximate period only once a unit is chosen', async () => {
    expect((await mountWhen({})).find('[data-test="admin-period-value"]').exists()).toBe(false)
    expect((await mountWhen({ periodUnit: 'century' })).find('[data-test="admin-period-value"]').exists()).toBe(true)
  })

  it('reports a year typed in as a patch, an empty year as nothing', async () => {
    const year = await mountWhen({ recordedPrecision: 'year' })
    await type(year.get<HTMLInputElement>('[data-test="admin-recorded-year"]').element, '1984')
    await type(year.get<HTMLInputElement>('[data-test="admin-recorded-year"]').element, '')
    expect(year.emitted('patch')).toEqual([[{ recordedYear: 1984 }], [{ recordedYear: null }]])
  })
})

describe('admin Kazivači', () => {
  it('shows at a glance whether the public sees the name or only the description', async () => {
    wrapper = await mountInApp(Narrators, '/admin/kazivaci')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Marija Horvat'))
    const badges = wrapper.findAll('[data-test="admin-narrator-consent-badge"]').map(badge => badge.text())
    expect(badges).toEqual(['Samo opis', 'Ime javno'])
    expect(wrapper.text()).toContain('kazivačica, r. 1938., Gornji Fodrovec')
  })

  it('makes the consent rule impossible to miss and requires a description without it', async () => {
    wrapper = await mountInApp(Narrators, '/admin/kazivaci?novo=1')
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Novi kazivač'))
    const alert = () => dialog()!.querySelector('[data-test="admin-narrator-consent-alert"]')!.textContent!
    expect(alert()).toContain('Bez pristanka javnost vidi samo javni opis.')
    expect(alert()).toContain('Ime se nikada ne prikazuje javno')
    expect(dialog()!.textContent).toContain('nikada se ne prikazuje javno')

    await type(dialog()!.querySelector<HTMLInputElement>('input')!, 'Marija Horvat')
    buttonIn(dialog(), 'Spremi skicu')!.click()
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Kazivač bez pristanka za javno navođenje imena treba javni opis'))
    expect(calls.filter(call => call.method === 'POST')).toEqual([])

    dialog()!.querySelector<HTMLButtonElement>('[data-test="admin-narrator-consent"]')!.click()
    await vi.waitFor(() => expect(alert()).toContain('Javnost vidi ime kazivača.'))
    expect(dialog()!.querySelector('[data-test="admin-narrator-public-label"]')?.textContent).toBe('Marija Horvat')
  })
})

describe('Memory → Draft', () => {
  it('offers to start a Story, Custom or Folk text from a Memory, and asks for the kind and type', async () => {
    wrapper = await mountInApp(Prijedlozi, '/admin/prijedlozi')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Na Martinje smo pekli kestenje.'))
    await wrapper.findAll('button[aria-label^="Detalji"]')[0]!.trigger('click')
    await vi.waitFor(() => expect(wrapper!.find('[data-test="admin-inbox-memory-draft"]').exists()).toBe(true))
    expect(wrapper.get('[data-test="admin-inbox-memory-draft"]').text()).toBe('Započni skicu priče, običaja ili teksta')

    await wrapper.get('[data-test="admin-inbox-memory-draft"]').trigger('click')
    await vi.waitFor(() => expect(dialog()?.querySelector('[data-test="admin-memory-draft-dialog"], [data-test="admin-memory-draft-kind"]')).not.toBeNull())
    expect(dialog()?.textContent).toContain('Priča')
    expect(dialog()?.textContent).toContain('Običaj')
    expect(dialog()?.textContent).toContain('Usmeni tekst')
    await vi.waitFor(() => expect(calls.some(call => call.path === '/api/admin/content/story_type')).toBe(true))
    expect(dialog()!.querySelector<HTMLButtonElement>('[data-test="admin-memory-draft-start"]')?.disabled).toBe(true)
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('shows which Draft a Memory produced and opens it with the Memory\'s banner', async () => {
    inboxRows = [{ ...memory, created: { kind: 'custom', id: STORY, label: 'Martinje', status: 'draft' } }]
    wrapper = await mountInApp(Prijedlozi, '/admin/prijedlozi')
    await vi.waitFor(() => expect(wrapper!.find('[data-test="admin-inbox-memory-draft-badge"]').exists()).toBe(true))
    expect(wrapper.get('[data-test="admin-inbox-memory-draft-badge"]').text()).toBe('Skica: Običaj')

    await wrapper.findAll('button[aria-label^="Detalji"]')[0]!.trigger('click')
    await vi.waitFor(() => expect(wrapper!.find('[data-test="admin-inbox-created"]').exists()).toBe(true))
    expect(wrapper.get('[data-test="admin-inbox-created"]').text()).toContain('Martinje')
    expect(wrapper.get('[data-test="admin-inbox-created"]').text()).toContain('(Običaj)')
    expect(wrapper.get('[data-test="admin-inbox-detail"]').text()).toContain('Nastalo iz sjećanja')
    // The Memory already has its Draft: the word flow is not offered beside it.
    expect(wrapper.find('[data-test="admin-inbox-draft"]').exists()).toBe(false)

    await wrapper.get('[data-test="admin-inbox-memory-draft"]').trigger('click')
    await vi.waitFor(() => expect(navigateToMock).toHaveBeenCalledWith({ path: '/admin/obicaji', query: { uredi: STORY, prijedlog: '15' } }))
  })
})
