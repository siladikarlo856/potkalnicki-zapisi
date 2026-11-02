import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { UApp } from '#components'
import AdminSources from '../app/pages/admin/izvori.vue'
import AdminDeleteDialog from '../app/components/admin/DeleteDialog.vue'
import Review from '../app/pages/admin/prilozi.vue'
import { adminListState } from '../app/composables/useAdminResource'
import type { AdminResource } from '../app/composables/useAdminResource'
import type { ContentReferences } from '../shared/utils/content/common'
import type { Source } from '../shared/utils/content/source'

// The admin CRUD kit, exercised through its first resource (Izvori) against mocked API routes.
// The pages are mounted inside <UApp>, which hosts toasts and the useOverlay confirmations.

const ID = '6f1c1c36-3a5e-4b7f-9a52-0d3f0b6c1a10'
const OTHER = '0a4f3d2e-8b1c-4d5e-9f60-718293a4b5c6'
const source: Source = {
  id: ID, title: 'Registar kulturnih dobara', type: 'official_registry', url: 'https://registar.kulturnadobra.hr/', note: null,
  status: 'published', revision: 3, createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z'
}
const draft: Source = { ...source, id: OTHER, title: 'Kajkavski rječnik', type: 'dictionary', url: null, status: 'draft', revision: 1 }

const calls: Array<{ method: string, path: string, query?: Record<string, string>, body?: unknown }> = []
let patchResponses: Array<() => unknown> = []
let references: ContentReferences = { blocking: false, groups: [] }

type WebEvent = { method: string, path: string, web: { request: Request } }
function record(event: unknown, body?: unknown) {
  const { method, path } = event as WebEvent
  const url = new URL(path.replace(/^\/_/, ''), 'http://localhost')
  calls.push({ method, path: url.pathname, query: Object.fromEntries(url.searchParams), body })
}

// The pages' `admin` route middleware asks for the session first.
registerEndpoint('/api/admin/session', () => ({ authenticated: true }))
registerEndpoint('/api/admin/content/source', {
  method: 'GET',
  handler: (event) => {
    record(event)
    return { rows: [source, draft], total: 2, page: 1, size: 25 }
  }
})
registerEndpoint('/api/admin/content/source', {
  method: 'POST',
  handler: async (event) => {
    const body = await (event as unknown as WebEvent).web.request.json()
    record(event, body)
    return { entity: { ...draft, ...body, id: OTHER } }
  }
})
registerEndpoint(`/api/admin/content/source/${ID}`, {
  method: 'GET',
  handler: (event) => {
    record(event)
    return { entity: source, legacyIds: ['registar-kulturnih-dobara'] }
  }
})
registerEndpoint(`/api/admin/content/source/${ID}`, {
  method: 'PATCH',
  handler: async (event) => {
    const body = await (event as unknown as WebEvent).web.request.json()
    record(event, body)
    const next = patchResponses.shift()
    return next ? next() : { entity: { ...source, ...body, revision: body.revision + 1 } }
  }
})
registerEndpoint(`/api/admin/content/source/${ID}`, {
  method: 'DELETE',
  handler: (event) => {
    record(event)
    return { mode: 'archive', entity: { ...source, status: 'archived' } }
  }
})
registerEndpoint(`/api/admin/content/source/${ID}/references`, (event) => {
  record(event)
  return references
})

const submission = {
  id: 7, text: 'Moja riječ', type: null, targetRef: null, place: null, placeId: null, name: null, contact: null,
  locale: 'hr', consentPublish: true, consentVersion: 'v1', status: 'pending', createdAt: '2026-10-30 10:00:00'
}
registerEndpoint('/api/review/submissions', () => [submission])
registerEndpoint('/api/review/submissions/7', {
  method: 'DELETE',
  handler: (event) => {
    record(event)
    return { ok: true }
  }
})

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(async () => {
  wrapper?.unmount()
  wrapper = undefined
  calls.length = 0
  patchResponses = []
  references = { blocking: false, groups: [] }
  await useRouter().replace({ query: {} })
})

function mountInApp(component: unknown, props: Record<string, unknown> = {}, route = '/admin/izvori') {
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

describe('admin list state', () => {
  const resource = {
    columns: [{ key: 'title', label: 'Naslov', sort: 'title' }],
    filters: [{ key: 'type', label: 'Vrsta', options: [{ label: 'Rječnik', value: 'dictionary' }] }],
    defaultSort: 'title'
  } as unknown as AdminResource

  it('reads the URL and falls back to defaults for anything unknown', () => {
    expect(adminListState({ q: 'kaj', page: '3', size: '50', sort: '-title', type: 'dictionary', status: 'draft' }, resource))
      .toEqual({ q: 'kaj', page: 3, size: 50, sort: '-title', filters: { type: 'dictionary', status: 'draft' } })
    expect(adminListState({ page: '0', size: '7', sort: 'secret', type: 'poem', status: 'deleted' }, resource))
      .toEqual({ q: '', page: 1, size: 25, sort: 'title', filters: { type: undefined, status: undefined } })
    expect(adminListState({ sort: '-updatedAt' }, resource).sort).toBe('-updatedAt')
  })
})

describe('admin CRUD kit: Izvori', () => {
  it('lists rows with labels, status and a total, and keeps search in the URL', async () => {
    wrapper = await mountInApp(AdminSources)
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Registar kulturnih dobara'))
    expect(wrapper.text()).toContain('Službeni registar')
    expect(wrapper.text()).toContain('Rječnik')
    expect(wrapper.text()).toContain('Objavljeno')
    expect(wrapper.text()).toContain('Skica')
    expect(wrapper.text()).toContain('2 zapisa')
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/api/admin/content/source', query: { page: '1', size: '25', sort: 'title' } })

    await type(wrapper.find<HTMLInputElement>('input[data-test="admin-search"]').element, 'cakovec')
    await vi.waitFor(() => expect(useRoute().query.q).toBe('cakovec'))
    await vi.waitFor(() => expect(calls.at(-1)?.query).toMatchObject({ q: 'cakovec', page: '1' }))
  })

  it('validates a new source with the shared validator before sending anything', async () => {
    wrapper = await mountInApp(AdminSources)
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Registar kulturnih dobara'))
    buttonIn(wrapper.element, 'Novi izvor')!.click()
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Novi izvor'))
    expect(useRoute().query.novo).toBe('1')
    buttonIn(dialog(), 'Objavi')!.click()
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Polje „Naslov“ je obavezno.'))
    expect(dialog()?.textContent).toContain('Polje „Vrsta“ je obavezno.')
    expect(calls.filter(call => call.method === 'POST')).toEqual([])
  })

  it('opens ?uredi=<uuid>, saves with the revision and shows ids under Napredno', async () => {
    wrapper = await mountInApp(AdminSources, {}, `/admin/izvori?uredi=${ID}`)
    await vi.waitFor(() => expect(dialog()?.querySelector<HTMLInputElement>('input[name="title"], input')?.value).toBe(source.title))
    expect(dialog()?.textContent).toContain('Uredi izvor')
    buttonIn(dialog(), 'Napredno')!.click()
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('registar-kulturnih-dobara'))
    expect(dialog()?.textContent).toContain(ID)
    expect(dialog()?.textContent).toContain('revizija 3')

    await type(dialog()!.querySelector<HTMLInputElement>('input')!, 'Registar kulturnih dobara RH')
    buttonIn(dialog(), 'Spremi')!.click()
    await vi.waitFor(() => expect(calls.find(call => call.method === 'PATCH')?.body).toMatchObject({
      title: 'Registar kulturnih dobara RH', type: 'official_registry', url: source.url, note: '', status: 'published', revision: 3
    }))
    await vi.waitFor(() => expect(useRoute().query.uredi).toBeUndefined())
    expect(document.body.textContent).toContain('Spremljeno')
  })

  it('offers reload or overwrite on a revision conflict', async () => {
    const current = { ...source, title: 'Tuđa izmjena', revision: 4, updatedAt: '2026-11-02T11:00:00.000Z' }
    patchResponses = [() => {
      throw createError({ statusCode: 409, statusMessage: 'Revision conflict', data: { code: 'revision-conflict', message: 'Sukob', current } })
    }]
    wrapper = await mountInApp(AdminSources, {}, `/admin/izvori?uredi=${ID}`)
    await vi.waitFor(() => expect(dialog()?.querySelector<HTMLInputElement>('input')?.value).toBe(source.title))
    await type(dialog()!.querySelector<HTMLInputElement>('input')!, 'Moja izmjena')
    buttonIn(dialog(), 'Spremi')!.click()
    await vi.waitFor(() => expect(dialog()?.querySelector('[data-test="admin-conflict"]')).not.toBeNull())

    buttonIn(dialog()!.querySelector('[data-test="admin-conflict"]')!, 'Prepiši')!.click()
    const patches = () => calls.filter(call => call.method === 'PATCH').map(call => call.body as { revision: number, title: string })
    await vi.waitFor(() => expect(patches().map(body => body.revision)).toEqual([3, 4]))
    expect(patches()[1]!.title).toBe('Moja izmjena')
  })

  it('asks before discarding unsaved changes', async () => {
    wrapper = await mountInApp(AdminSources, {}, `/admin/izvori?uredi=${ID}`)
    await vi.waitFor(() => expect(dialog()?.querySelector<HTMLInputElement>('input')?.value).toBe(source.title))
    await type(dialog()!.querySelector<HTMLInputElement>('input')!, 'Nespremljeno')
    buttonIn(dialog(), 'Odustani')!.click()
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Odbaciti promjene?'))
    buttonIn(dialog(), 'Nastavi uređivati')!.click()
    await vi.waitFor(() => expect(dialogs()).toHaveLength(1))
    expect(useRoute().query.uredi).toBe(ID)

    buttonIn(dialog(), 'Odustani')!.click()
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Odbaciti promjene?'))
    buttonIn(dialog(), 'Odbaci promjene')!.click()
    await vi.waitFor(() => expect(useRoute().query.uredi).toBeUndefined())
    expect(calls.filter(call => call.method === 'PATCH')).toEqual([])
  })
})

describe('admin delete dialog', () => {
  const resource = { kind: 'source' as const, label: (entity: Source) => entity.title }

  it('lists blocking references, disables hard delete and archives instead', async () => {
    references = {
      blocking: true,
      groups: [{ kind: 'heritage_item', label: 'Zapisi baštine', count: 7, blocking: true, items: [{ id: 'a', label: 'Crkva sv. Ane' }] }]
    }
    wrapper = await mountInApp(AdminDeleteDialog, { resource, entity: source, open: true })
    await vi.waitFor(() => expect(dialog()?.querySelector('[data-test="admin-delete-blocked"]')).not.toBeNull())
    expect(dialog()?.textContent).toContain('Zapisi baštine: 7')
    expect(dialog()?.textContent).toContain('Crkva sv. Ane')
    expect(dialog()?.textContent).toContain('… i još 6')
    expect(dialog()?.querySelector<HTMLButtonElement>('[data-test="admin-hard-delete"]')?.disabled).toBe(true)

    dialog()!.querySelector<HTMLButtonElement>('[data-test="admin-archive"]')!.click()
    await vi.waitFor(() => expect(calls.find(call => call.method === 'DELETE')).toMatchObject({ path: `/api/admin/content/source/${ID}`, query: { mode: 'archive' } }))
  })

  it('offers a permanent delete when nothing refers to the row', async () => {
    wrapper = await mountInApp(AdminDeleteDialog, { resource, entity: source, open: true })
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Ništa ne upućuje na ovaj zapis.'))
    expect(dialog()?.querySelector<HTMLButtonElement>('[data-test="admin-hard-delete"]')?.disabled).toBe(false)
  })
})

describe('admin confirmations', () => {
  it('asks in a dialog, not window.confirm, before deleting a submission', async () => {
    const native = vi.fn(() => true)
    vi.stubGlobal('confirm', native)
    wrapper = await mountInApp(Review, {}, '/admin/prilozi')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Moja riječ'))
    await wrapper.find('button[aria-label^="Detalji"]').trigger('click')

    buttonIn(wrapper.element, 'Obriši')!.click()
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Trajno obrisati prijavu #7?'))
    dialog()!.querySelector<HTMLButtonElement>('[data-test="admin-confirm-cancel"]')!.click()
    await vi.waitFor(() => expect(dialog()).toBeUndefined())
    expect(calls.filter(call => call.method === 'DELETE')).toEqual([])

    buttonIn(wrapper.element, 'Obriši')!.click()
    await vi.waitFor(() => expect(dialog()?.querySelector('[data-test="admin-confirm-accept"]')).not.toBeNull())
    dialog()!.querySelector<HTMLButtonElement>('[data-test="admin-confirm-accept"]')!.click()
    await vi.waitFor(() => expect(calls.filter(call => call.method === 'DELETE')).toEqual([expect.objectContaining({ path: '/api/review/submissions/7' })]))
    expect(native).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
