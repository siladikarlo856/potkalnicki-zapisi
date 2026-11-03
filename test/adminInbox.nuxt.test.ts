import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { UApp } from '#components'
import AdminSources from '../app/pages/admin/izvori.vue'
import Prijedlozi from '../app/pages/admin/prijedlozi.vue'
import type { InboxDetail, InboxRow } from '../shared/types/inbox'
import type { Source } from '../shared/utils/content/source'

// The admin inbox (/admin/prijedlozi) and the apply flow in the content dialog, against mocked API routes.

const ITEM = '6f1c1c36-3a5e-4b7f-9a52-0d3f0b6c1a10'
const SOURCE_ID = '0a4f3d2e-8b1c-4d5e-9f60-718293a4b5c6'

const { navigateToMock } = vi.hoisted(() => ({ navigateToMock: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateToMock)

type WebEvent = { method: string, path: string, web: { request: Request } }
const calls: Array<{ method: string, path: string, body?: unknown }> = []
async function record(event: unknown, withBody = false) {
  const { method, path, web } = event as WebEvent
  calls.push({ method, path: new URL(path.replace(/^\/_/, ''), 'http://localhost').pathname, body: withBody ? await web.request.json() : undefined })
}

const base = {
  text: 'Naziv je drugačiji.', type: 'correction' as const, targetKind: 'heritage_item' as const, targetId: ITEM, payload: { name: 'Kapela sv. Ane' },
  baseRevision: 2, wordId: null, intent: null, wordHeadword: null, place: null, placeId: null, placeCatalogVersion: null, placeContext: null,
  name: 'Ana Horvat', contact: 'ana@example.com', consentPublish: true, consentVersion: '2026-11-02', locale: 'hr' as const,
  status: 'pending' as const, createdAt: '2026-11-02 10:00:00', reviewedAt: null, appliedAt: null, appliedEntityId: null, created: null, canDraft: false
}
const correction: InboxRow = { ...base, id: 12, target: { kind: 'heritage_item', id: ITEM, label: 'Kapela sv. Ana', state: 'ok', status: 'published', revision: 3 } }
const proposal: InboxRow = {
  ...base, id: 13, type: 'proposal', text: 'Fali kapela uz cestu.', targetId: null, targetKind: 'heritage_item', payload: { name: 'Nova kapela' }, baseRevision: null,
  target: null, canDraft: true
}
const applied: InboxRow = { ...correction, id: 14, status: 'approved', appliedAt: '2026-11-02 12:00:00', appliedEntityId: ITEM }
const plain: InboxRow = { ...base, id: 15, type: 'memory', text: 'Sjećanje na bake.', targetKind: null, targetId: null, payload: null, baseRevision: null, target: null, canDraft: true }

let rows: InboxRow[] = [correction, proposal, applied, plain]
let stale = true
const details: Record<number, () => InboxDetail> = {
  12: () => ({
    submission: correction, stale,
    changes: [
      { field: 'name', label: 'Naziv', current: 'Kapela sv. Ana', proposed: 'Kapela sv. Ane', applicable: true },
      { field: 'sourceNote', label: 'Izvor ili literatura', current: null, proposed: 'Župna kronika', applicable: false }
    ],
    patch: { name: 'Kapela sv. Ane' }
  }),
  13: () => ({ submission: proposal, stale: false, changes: [{ field: 'name', label: 'Naziv', current: null, proposed: 'Nova kapela', applicable: false }], patch: null }),
  14: () => ({ submission: applied, stale: false, changes: [], patch: null })
}

async function deleteRoute(event: unknown) {
  await record(event)
  return { ok: true }
}
async function draftRoute(event: unknown) {
  await record(event)
  return { kind: 'heritage_item', id: ITEM, created: true }
}
async function bulkRoute(event: unknown) {
  await record(event, true)
  return { done: 2, skipped: 0 }
}

registerEndpoint('/api/admin/session', () => ({ authenticated: true }))
registerEndpoint('/api/admin/inbox', () => ({ rows, total: rows.length, page: 1, size: 25, counts: { pending: 3 } }))
registerEndpoint('/api/admin/inbox/summary', () => ({ pending: 3 }))
for (const id of [12, 13, 14, 15]) {
  registerEndpoint(`/api/admin/inbox/${id}`, { method: 'GET', handler: () => details[id]?.() ?? { submission: plain, changes: [], patch: null, stale: false } })
  registerEndpoint(`/api/admin/inbox/${id}`, { method: 'DELETE', handler: deleteRoute })
}
registerEndpoint('/api/admin/inbox/13/draft', { method: 'POST', handler: draftRoute })
registerEndpoint('/api/admin/inbox/bulk', { method: 'POST', handler: bulkRoute })

const source: Source = {
  id: SOURCE_ID, title: 'Stari naslov', type: 'publication', url: null, note: null, status: 'published', revision: 5,
  createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z'
}
registerEndpoint('/api/admin/content/source', () => ({ rows: [source], total: 1, page: 1, size: 25 }))
registerEndpoint(`/api/admin/content/source/${SOURCE_ID}`, { method: 'GET', handler: () => ({ entity: source, legacyIds: [] }) })
registerEndpoint(`/api/admin/content/source/${SOURCE_ID}`, {
  method: 'PATCH',
  handler: async (event) => {
    await record(event, true)
    return { entity: { ...source, revision: 6 } }
  }
})
registerEndpoint('/api/admin/inbox/21', () => ({
  // Sources take no credits, so the banner is shown for a kind that does; the dialog only matches the target id.
  submission: { ...correction, id: 21, targetId: SOURCE_ID },
  stale: false, changes: [{ field: 'title', label: 'Naslov', current: 'Stari naslov', proposed: 'Predloženi naslov', applicable: true }], patch: { title: 'Predloženi naslov' }
} satisfies InboxDetail))

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(async () => {
  wrapper?.unmount()
  wrapper = undefined
  calls.length = 0
  navigateToMock.mockClear()
  rows = [correction, proposal, applied, plain]
  stale = true
  await useRouter().replace({ query: {} })
})

function mountInApp(component: unknown, route: string) {
  return mountSuspended({ setup: () => () => h(UApp, null, { default: () => h(component as never) }) }, { attachTo: document.body, route })
}
const dialog = () => [...document.body.querySelectorAll<HTMLElement>('[role="dialog"]')].at(-1)
const buttonIn = (root: ParentNode | undefined, label: string) =>
  [...(root?.querySelectorAll('button') ?? [])].find(item => item.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined
async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

describe('admin inbox', () => {
  it('lists every kind of submission with what it points at and its state', async () => {
    wrapper = await mountInApp(Prijedlozi, '/admin/prijedlozi')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Naziv je drugačiji.'))
    const text = wrapper.text()
    expect(text).toContain('Ispravak')
    expect(text).toContain('Prijedlog novog zapisa')
    expect(text).toContain('Zapis baštine · Kapela sv. Ana')
    expect(text).toContain('Primijenjeno')
    expect(text).toContain('Sjećanje ili priča')
    expect(text).toContain('Na čekanju: 3')
  })

  it('shows the diff of a correction, warns when the target changed, and applies it in the target\'s own dialog', async () => {
    wrapper = await mountInApp(Prijedlozi, '/admin/prijedlozi')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Naziv je drugačiji.'))
    await wrapper.findAll('button[aria-label^="Detalji"]')[0]!.trigger('click')
    await vi.waitFor(() => expect(wrapper!.find('[data-test="admin-inbox-changes"]').exists()).toBe(true))
    const changes = wrapper.get('[data-test="admin-inbox-changes"]').text()
    expect(changes).toContain('Kapela sv. Ana')
    expect(changes).toContain('Kapela sv. Ane')
    expect(changes).toContain('Samo za informaciju.')
    expect(wrapper.find('[data-test="admin-inbox-stale"]').exists()).toBe(true)
    // The contributor's note is shown as plain text, never as a link.
    expect(wrapper.find('[data-test="admin-inbox-detail"] a[href^="http"]').exists()).toBe(false)

    await wrapper.get('[data-test="admin-inbox-apply"]').trigger('click')
    await vi.waitFor(() => expect(navigateToMock).toHaveBeenCalledWith({ path: '/admin/bastina', query: { uredi: ITEM, prijedlog: '12' } }))
  })

  it('turns a proposal into a draft and opens it in the content dialog; an applied row offers no apply', async () => {
    wrapper = await mountInApp(Prijedlozi, '/admin/prijedlozi')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Fali kapela uz cestu.'))
    const infos = wrapper.findAll('button[aria-label^="Detalji"]')
    await infos[1]!.trigger('click')
    await vi.waitFor(() => expect(wrapper!.find('[data-test="admin-inbox-draft"]').exists()).toBe(true))
    await wrapper.get('[data-test="admin-inbox-draft"]').trigger('click')
    await vi.waitFor(() => expect(calls).toContainEqual(expect.objectContaining({ method: 'POST', path: '/api/admin/inbox/13/draft' })))
    await vi.waitFor(() => expect(navigateToMock).toHaveBeenCalledWith({ path: '/admin/bastina', query: { uredi: ITEM, prijedlog: '13' } }))
  })

  it('asks in a dialog before deleting and offers "Odobri bez izmjene"', async () => {
    wrapper = await mountInApp(Prijedlozi, '/admin/prijedlozi')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Naziv je drugačiji.'))
    await wrapper.findAll('button[aria-label^="Detalji"]')[0]!.trigger('click')
    await vi.waitFor(() => expect(wrapper!.find('[data-test="admin-inbox-delete"]').exists()).toBe(true))
    expect(wrapper.find('[data-test="admin-inbox-approve"]').exists()).toBe(true)
    buttonIn(wrapper.element, 'Obriši')!.click()
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Obrisati prijedlog #12?'))
    expect(dialog()?.textContent).toContain('Zahvala doprinositelju')
    dialog()!.querySelector<HTMLButtonElement>('[data-test="admin-confirm-cancel"]')!.click()
    await vi.waitFor(() => expect(dialog()).toBeUndefined())
    expect(calls.filter(call => call.method === 'DELETE')).toEqual([])
  })

  it('selects several rows and rejects them in one request after a confirmation', async () => {
    wrapper = await mountInApp(Prijedlozi, '/admin/prijedlozi')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Naziv je drugačiji.'))
    const boxes = wrapper.findAll('button[role="checkbox"]')
    // The first checkbox selects the whole page; two rows are then deselected.
    await boxes[0]!.trigger('click')
    await vi.waitFor(() => expect(wrapper!.find('[data-test="admin-inbox-bulk"]').exists()).toBe(true))
    expect(wrapper.get('[data-test="admin-inbox-bulk"]').text()).toContain('Odabrano: 4')
    await wrapper.findAll('button[role="checkbox"]')[3]!.trigger('click')
    await wrapper.findAll('button[role="checkbox"]')[4]!.trigger('click')
    await vi.waitFor(() => expect(wrapper!.get('[data-test="admin-inbox-bulk"]').text()).toContain('Odabrano: 2'))

    buttonIn(wrapper.get('[data-test="admin-inbox-bulk"]').element, 'Odbij odabrane')!.click()
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Odbiti 2 prijedloga?'))
    dialog()!.querySelector<HTMLButtonElement>('[data-test="admin-confirm-accept"]')!.click()
    await vi.waitFor(() => expect(calls.find(call => call.path === '/api/admin/inbox/bulk')?.body).toEqual({ ids: [12, 13], action: 'reject' }))
  })
})

describe('applying a submission in the content dialog', () => {
  it('fills in the proposed values, shows the banner, and saves with applySubmissionId and the credit choice', async () => {
    wrapper = await mountInApp(AdminSources, `/admin/izvori?uredi=${SOURCE_ID}&prijedlog=21`)
    await vi.waitFor(() => expect(dialog()?.querySelector('[data-test="admin-proposal-banner"]')).not.toBeNull())
    expect(dialog()?.querySelector<HTMLInputElement>('input')?.value).toBe('Predloženi naslov')
    expect(dialog()?.textContent).toContain('Ispravak #21')
    expect(dialog()?.textContent).toContain('Stari naslov')

    // Credit is on by default for a named contributor; the admin can untick it.
    dialog()!.querySelector<HTMLButtonElement>('[role="checkbox"]')!.click()
    await nextTick()
    buttonIn(dialog(), 'Spremi')!.click()
    await vi.waitFor(() => expect(calls.find(call => call.method === 'PATCH')?.body).toMatchObject({
      title: 'Predloženi naslov', revision: 5, applySubmissionId: 21, applyCredit: false
    }))
  })

  it('sends no apply fields when the dialog was opened without a submission', async () => {
    wrapper = await mountInApp(AdminSources, `/admin/izvori?uredi=${SOURCE_ID}`)
    await vi.waitFor(() => expect(dialog()?.querySelector<HTMLInputElement>('input')?.value).toBe('Stari naslov'))
    expect(dialog()?.querySelector('[data-test="admin-proposal-banner"]')).toBeNull()
    await type(dialog()!.querySelector<HTMLInputElement>('input')!, 'Drugi naslov')
    buttonIn(dialog(), 'Spremi')!.click()
    await vi.waitFor(() => expect(calls.find(call => call.method === 'PATCH')?.body).toMatchObject({ title: 'Drugi naslov', revision: 5 }))
    expect(calls.find(call => call.method === 'PATCH')?.body).not.toHaveProperty('applySubmissionId')
  })
})
