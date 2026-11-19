import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { UApp } from '#components'
import AdminSources from '../app/pages/admin/izvori.vue'
import AdminHistory from '../app/pages/admin/povijest.vue'
import AdminHistoryChanges from '../app/components/admin/HistoryChanges.vue'
import type { HistoryLog, HistoryRevisions } from '../shared/utils/content/history'

// The history screens against mocked API routes: the drawer opened from a row's menu or `?povijest=`,
// its field diffs, restoring a version, and the global log at /admin/povijest.

const ID = '6f1c1c36-3a5e-4b7f-9a52-0d3f0b6c1a10'
const GONE = '0a4f3d2e-8b1c-4d5e-9f60-718293a4b5c6'
const source = {
  id: ID, title: 'Registar kulturnih dobara', type: 'official_registry', url: null, note: null,
  status: 'published', revision: 3, createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z'
}

const revisions: HistoryRevisions = {
  kind: 'source', entityId: ID, label: 'Registar kulturnih dobara', exists: true, currentRevision: 3, hasMore: true,
  revisions: [
    { id: 30, revision: 3, action: 'update', actor: 'admin', createdAt: '2026-11-02T10:00:00.000Z', submissionId: null, changes: [{ field: 'type', before: 'dictionary', after: 'official_registry' }] },
    { id: 20, revision: 2, action: 'update', actor: 'admin', createdAt: '2026-11-01T12:00:00.000Z', submissionId: 7, changes: [{ field: 'title', before: 'Registar', after: 'Registar kulturnih dobara' }, { field: 'note', before: 'stara', after: null }] },
    { id: 10, revision: 1, action: 'insert', actor: 'import', createdAt: '2026-11-01T10:00:00.000Z', submissionId: null, changes: [{ field: 'title', before: null, after: 'Registar' }] }
  ]
}
const older: HistoryRevisions = { ...revisions, hasMore: false, revisions: [
  { id: 5, revision: 0, action: 'insert', actor: 'import', createdAt: '2026-10-31T10:00:00.000Z', submissionId: null, changes: [] }
] }
const deleted: HistoryRevisions = {
  kind: 'source', entityId: GONE, label: 'Kajkavski rječnik', exists: false, currentRevision: null, hasMore: false,
  revisions: [
    { id: 90, revision: 2, action: 'delete', actor: 'admin', createdAt: '2026-11-02T09:00:00.000Z', submissionId: null, changes: [{ field: 'title', before: 'Kajkavski rječnik', after: null }] },
    { id: 80, revision: 1, action: 'insert', actor: 'admin', createdAt: '2026-11-01T09:00:00.000Z', submissionId: null, changes: [{ field: 'title', before: null, after: 'Kajkavski rječnik' }] }
  ]
}
const log: HistoryLog = {
  total: 3, page: 1, size: 25, rows: [
    { id: 90, kind: 'source', entityId: GONE, revision: 2, action: 'delete', actor: 'admin', createdAt: '2026-11-02T09:00:00.000Z', submissionId: null, label: 'Kajkavski rječnik', registered: true },
    { id: 70, kind: 'word', entityId: '11111111-1111-4111-8111-111111111111', revision: 4, action: 'update', actor: 'admin', createdAt: '2026-11-02T08:00:00.000Z', submissionId: null, label: 'hiža', registered: false },
    { id: 60, kind: 'heritage_item', entityId: '22222222-2222-4222-8222-222222222222', revision: 1, action: 'insert', actor: 'import', createdAt: '2026-11-01T08:00:00.000Z', submissionId: null, label: 'Crkva sv. Ane', registered: false }
  ]
}

const calls: Array<{ method: string, path: string, query?: Record<string, string>, body?: unknown }> = []
let restoreResponses: Array<() => unknown> = []

type WebEvent = { method: string, path: string, web: { request: Request } }
function record(event: unknown, body?: unknown) {
  const { method, path } = event as WebEvent
  const url = new URL(path.replace(/^\/_/, ''), 'http://localhost')
  calls.push({ method, path: url.pathname, query: Object.fromEntries(url.searchParams), body })
}

registerEndpoint('/api/admin/session', () => ({ authenticated: true }))
registerEndpoint('/api/admin/content/source', () => ({ rows: [source], total: 1, page: 1, size: 25 }))
registerEndpoint(`/api/admin/content/source/${ID}/revisions`, (event) => {
  record(event)
  return new URL((event as unknown as WebEvent).path.replace(/^\/_/, ''), 'http://localhost').searchParams.get('before') ? older : revisions
})
registerEndpoint(`/api/admin/content/source/${GONE}/revisions`, (event) => {
  record(event)
  return deleted
})
registerEndpoint(`/api/admin/content/source/${ID}/restore`, {
  method: 'POST',
  handler: async (event) => {
    record(event, await (event as unknown as WebEvent).web.request.json())
    const next = restoreResponses.shift()
    return next ? next() : { unchanged: false, recreated: false, entity: source }
  }
})
registerEndpoint(`/api/admin/content/source/${GONE}/restore`, {
  method: 'POST',
  handler: async (event) => {
    record(event, await (event as unknown as WebEvent).web.request.json())
    return { unchanged: false, recreated: true, entity: { ...source, id: GONE } }
  }
})
registerEndpoint('/api/admin/history', (event) => {
  record(event)
  return log
})

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(async () => {
  wrapper?.unmount()
  wrapper = undefined
  calls.length = 0
  restoreResponses = []
  await useRouter().replace({ query: {} })
})

function mountInApp(component: unknown, props: Record<string, unknown> = {}, route = '/admin/izvori') {
  return mountSuspended({ setup: () => () => h(UApp, null, { default: () => h(component as never, props) }) }, { attachTo: document.body, route })
}

const dialogs = () => [...document.body.querySelectorAll<HTMLElement>('[role="dialog"]')]
const confirmation = () => dialogs().find(element => element.querySelector('[data-test="admin-confirm-accept"]'))
const drawer = () => dialogs().find(element => element !== confirmation() && element.textContent?.includes('Povijest'))
const buttonIn = (root: ParentNode | undefined | null, label: string) =>
  [...(root?.querySelectorAll('button') ?? [])].find(item => item.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined

describe('history changes', () => {
  it('shows before and after for an update, only values for a creation and a deletion', async () => {
    const update = await mountSuspended(AdminHistoryChanges, { props: { kind: 'source', action: 'update', changes: revisions.revisions[0]!.changes } })
    expect(update.text()).toContain('Vrsta')
    expect(update.text()).toContain('Prije: Rječnik')
    expect(update.text()).toContain('Poslije: Službeni registar')

    const created = await mountSuspended(AdminHistoryChanges, { props: { kind: 'source', action: 'insert', changes: revisions.revisions[2]!.changes } })
    expect(created.text()).toContain('Poslije: Registar')
    expect(created.text()).not.toContain('Prije:')

    const removed = await mountSuspended(AdminHistoryChanges, { props: { kind: 'source', action: 'delete', changes: deleted.revisions[0]!.changes } })
    expect(removed.text()).toContain('Prije: Kajkavski rječnik')
    expect(removed.text()).not.toContain('Poslije:')

    const empty = await mountSuspended(AdminHistoryChanges, { props: { kind: 'source', action: 'update', changes: [] } })
    expect(empty.text()).toContain('Bez promjena u uređivanim poljima.')
  })
})

describe('history drawer on a resource page', () => {
  it('opens from the row menu, lists revisions with diffs and marks the current one', async () => {
    wrapper = await mountInApp(AdminSources)
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Registar kulturnih dobara'))
    document.body.querySelector<HTMLButtonElement>('button[aria-label^="Radnje:"]')!.click()
    await vi.waitFor(() => expect([...document.body.querySelectorAll('[role="menuitem"]')].some(item => item.textContent?.includes('Povijest'))).toBe(true))
    ;[...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.textContent?.includes('Povijest'))!.click()

    await vi.waitFor(() => expect(drawer()?.textContent).toContain('Revizija 3'))
    expect(useRoute().query.povijest).toBe(ID)
    const text = drawer()!.textContent!
    expect(text).toContain('Povijest izmjena')
    expect(text).toContain('Registar kulturnih dobara')
    expect(text).toContain('Izvor · revizija 3')
    expect(text).toContain('trenutačna inačica')
    expect(text).toContain('Poslije: Službeni registar')
    expect(text).toContain('iz priloga #7')
    expect(text).toContain('Uvoz sadržaja')
    // The current version cannot be restored onto itself; the two older ones can.
    expect(drawer()!.querySelectorAll('[data-test="history-restore"]')).toHaveLength(2)
    expect(drawer()!.querySelector('[data-test="history-revision-3"] [data-test="history-restore"]')).toBeNull()
  })

  it('loads older revisions with the last id as the cursor', async () => {
    wrapper = await mountInApp(AdminSources, {}, `/admin/izvori?povijest=${ID}`)
    await vi.waitFor(() => expect(drawer()?.textContent).toContain('Revizija 1'))
    buttonIn(drawer(), 'Učitaj starije')!.click()
    await vi.waitFor(() => expect(drawer()?.textContent).toContain('Revizija 0'))
    expect(calls.filter(call => call.path.endsWith('/revisions')).map(call => call.query)).toEqual([{}, { before: '10' }])
    expect(buttonIn(drawer(), 'Učitaj starije')).toBeUndefined()
  })

  it('confirms, restores with the revision the screen saw, and refreshes', async () => {
    wrapper = await mountInApp(AdminSources, {}, `/admin/izvori?povijest=${ID}`)
    await vi.waitFor(() => expect(drawer()?.textContent).toContain('Revizija 2'))
    drawer()!.querySelector<HTMLButtonElement>('[data-test="history-revision-2"] [data-test="history-restore"]')!.click()
    await vi.waitFor(() => expect(confirmation()?.textContent).toContain('Želiš li vratiti inačicu od'))
    expect(calls.filter(call => call.method === 'POST')).toEqual([])
    buttonIn(confirmation(), 'Vrati')!.click()

    await vi.waitFor(() => expect(calls.find(call => call.method === 'POST')).toMatchObject({ path: `/api/admin/content/source/${ID}/restore`, body: { revisionId: 20, revision: 3 } }))
    await vi.waitFor(() => expect(document.body.textContent).toContain('Verzija je vraćena'))
    // The history is read again and the list behind it refreshed.
    await vi.waitFor(() => expect(calls.filter(call => call.path.endsWith('/revisions'))).toHaveLength(2))
  })

  it('does nothing when the confirmation is cancelled', async () => {
    wrapper = await mountInApp(AdminSources, {}, `/admin/izvori?povijest=${ID}`)
    await vi.waitFor(() => expect(drawer()?.textContent).toContain('Revizija 2'))
    drawer()!.querySelector<HTMLButtonElement>('[data-test="history-revision-1"] [data-test="history-restore"]')!.click()
    await vi.waitFor(() => expect(confirmation()).toBeDefined())
    buttonIn(confirmation(), 'Odustani')!.click()
    await vi.waitFor(() => expect(confirmation()).toBeUndefined())
    expect(calls.filter(call => call.method === 'POST')).toEqual([])
  })

  it('reloads and warns after a revision conflict', async () => {
    restoreResponses = [() => {
      throw createError({ statusCode: 409, statusMessage: 'Revision conflict', data: { code: 'revision-conflict', message: 'Sukob', current: { ...source, revision: 4 } } })
    }]
    wrapper = await mountInApp(AdminSources, {}, `/admin/izvori?povijest=${ID}`)
    await vi.waitFor(() => expect(drawer()?.textContent).toContain('Revizija 2'))
    drawer()!.querySelector<HTMLButtonElement>('[data-test="history-revision-2"] [data-test="history-restore"]')!.click()
    await vi.waitFor(() => expect(confirmation()).toBeDefined())
    buttonIn(confirmation(), 'Vrati')!.click()
    await vi.waitFor(() => expect(document.body.textContent).toContain('Zapis je u međuvremenu izmijenjen'))
    await vi.waitFor(() => expect(calls.filter(call => call.path.endsWith('/revisions'))).toHaveLength(2))
  })

  it('offers to recreate a deleted row', async () => {
    wrapper = await mountInApp(AdminSources, {}, `/admin/izvori?povijest=${GONE}`)
    await vi.waitFor(() => expect(drawer()?.textContent).toContain('Obrisano'))
    expect(drawer()!.textContent).toContain('Izvor · obrisano')
    expect(drawer()!.textContent).not.toContain('trenutačna inačica')
    expect(buttonIn(drawer(), 'Uredi zapis')).toBeUndefined()
    const buttons = [...drawer()!.querySelectorAll<HTMLButtonElement>('[data-test="history-restore"]')]
    expect(buttons.map(button => button.textContent?.trim())).toEqual(['Vrati zapis u ovoj inačici', 'Vrati zapis u ovoj inačici'])
    buttons[1]!.click()
    await vi.waitFor(() => expect(confirmation()?.textContent).toContain('Vratiti obrisani zapis?'))
    buttonIn(confirmation(), 'Vrati')!.click()
    await vi.waitFor(() => expect(calls.find(call => call.method === 'POST')?.body).toEqual({ revisionId: 80 }))
    await vi.waitFor(() => expect(document.body.textContent).toContain('Zapis je vraćen'))
  })

  it('ignores a malformed ?povijest= value', async () => {
    wrapper = await mountInApp(AdminSources, {}, '/admin/izvori?povijest=nope')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Registar kulturnih dobara'))
    expect(calls.filter(call => call.path.endsWith('/revisions'))).toEqual([])
    expect(dialogs()).toHaveLength(0)
  })
})

describe('change log page', () => {
  it('lists changes of every kind with labels, and keeps filters in the URL', async () => {
    wrapper = await mountInApp(AdminHistory, {}, '/admin/povijest')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Kajkavski rječnik'))
    const text = wrapper.text()
    expect(text).toContain('Obrisano')
    expect(text).toContain('hiža')
    expect(text).toContain('Riječ')
    expect(text).toContain('Crkva sv. Ane')
    expect(text).toContain('Zapis baštine')
    expect(text).toContain('3 izmjene')
    expect(calls[0]).toMatchObject({ path: '/api/admin/history', query: { page: '1', size: '25' } })

    await useRouter().replace({ query: { vrsta: 'source', radnja: 'delete', autor: 'import', page: '2', size: '50' } })
    await vi.waitFor(() => expect(calls.at(-1)?.query).toMatchObject({ kind: 'source', action: 'delete', actor: 'import', page: '2', size: '50' }))
  })

  it('ignores unknown filter values', async () => {
    wrapper = await mountInApp(AdminHistory, {}, '/admin/povijest?vrsta=sources&radnja=remove&autor=x&page=0&size=7')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Kajkavski rječnik'))
    expect(calls[0]!.query).toEqual({ page: '1', size: '25' })
  })

  it('opens the drawer for kinds with an admin resource and not for the others', async () => {
    wrapper = await mountInApp(AdminHistory, {}, '/admin/povijest')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Kajkavski rječnik'))
    // Words and heritage items have no admin resource yet, so their rows are plain text.
    expect([...wrapper.element.querySelectorAll('button')].some(button => button.textContent?.trim() === 'hiža')).toBe(false)
    buttonIn(wrapper.element, 'Kajkavski rječnik')!.click()
    await vi.waitFor(() => expect(useRoute().query.zapis).toBe(`source:${GONE}`))
    await vi.waitFor(() => expect(drawer()?.textContent).toContain('Vrati zapis u ovoj inačici'))
  })
})
