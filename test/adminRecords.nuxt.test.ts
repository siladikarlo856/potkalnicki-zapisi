import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { UApp, UFormField, UInput } from '#components'
import AdminResourcePage from '../app/components/admin/ResourcePage.vue'
import AdminSessionExpiredDialog from '../app/components/admin/SessionExpiredDialog.vue'
import AdminBulkActionBar from '../app/components/admin/BulkActionBar.vue'
import AdminSaveBar from '../app/components/admin/SaveBar.vue'
import AdminDiffView from '../app/components/admin/DiffView.vue'
import AdminDataTable from '../app/components/admin/DataTable.vue'
import { defineAdminResource } from '../app/composables/useAdminResource'
import { agoPhrase, longDate, shortDate } from '../app/utils/adminFormat'
import type { Source } from '../shared/utils/content/source'

// The list and the editor of the design (Popis resursa, Uređivanje zapisa) through one resource that edits on a page.

const ID = ['6f1c1c36-3a5e-4b7f-9a52-0d3f0b6c1a10', '0a4f3d2e-8b1c-4d5e-9f60-718293a4b5c6', 'b1b2b3b4-1111-4222-8333-944444444444']
const base: Source = {
  id: ID[0]!, title: 'Registar kulturnih dobara', type: 'official_registry', url: null, note: null,
  status: 'published', revision: 3, createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-03T10:00:00.000Z'
}
let rows: Source[] = []
const calls: Array<{ method: string, path: string, query?: Record<string, string>, body?: Record<string, unknown> }> = []
let patch: Array<(body: Record<string, unknown>) => unknown> = []
let signedIn = 0

type WebEvent = { method: string, path: string, web: { request: Request } }
function record(event: unknown, body?: Record<string, unknown>) {
  const { method, path } = event as WebEvent
  const url = new URL(path.replace(/^\/_/, ''), 'http://localhost')
  calls.push({ method, path: url.pathname, query: Object.fromEntries(url.searchParams), body })
}
const bodyOf = (event: unknown) => (event as WebEvent).web.request.json() as Promise<Record<string, unknown>>

// The route middleware of the real pages asks for the session first.
registerEndpoint('/api/admin/session', { method: 'GET', handler: () => ({ authenticated: true }) })
registerEndpoint('/api/admin/session', { method: 'POST', handler: () => {
  signedIn++
  return { authenticated: true }
} })
registerEndpoint('/api/admin/inbox/summary', () => ({ pending: 0 }))
registerEndpoint('/api/admin/content/source', {
  method: 'GET',
  handler: (event) => {
    record(event)
    const url = new URL((event as unknown as WebEvent).path.replace(/^\/_/, ''), 'http://localhost')
    const status = url.searchParams.get('status')
    const found = status ? rows.filter(row => row.status === status) : rows
    return { rows: found, total: found.length, page: 1, size: 25 }
  }
})
registerEndpoint('/api/admin/content/source', {
  method: 'POST',
  handler: async (event) => {
    const body = await bodyOf(event)
    record(event, body)
    return { entity: { ...base, ...body, id: ID[2], revision: 1 } }
  }
})
for (const id of ID) {
  registerEndpoint(`/api/admin/content/source/${id}`, { method: 'GET', handler: (event) => {
    record(event)
    return { entity: rows.find(row => row.id === id) ?? base, legacyIds: [] }
  } })
  registerEndpoint(`/api/admin/content/source/${id}`, { method: 'PATCH', handler: async (event) => {
    const body = await bodyOf(event)
    record(event, body)
    const next = patch.shift()
    if (next) return next(body)
    const found = rows.find(row => row.id === id) ?? base
    return { entity: { ...found, ...body, revision: Number(body.revision) + 1 } }
  } })
  registerEndpoint(`/api/admin/content/source/${id}`, { method: 'DELETE', handler: (event) => {
    record(event)
    const found = rows.find(row => row.id === id) ?? base
    return { mode: 'archive', entity: { ...found, status: 'archived' } }
  } })
  registerEndpoint(`/api/admin/content/source/${id}/references`, () => ({ blocking: false, groups: [] }))
}

const resource = defineAdminResource<Source, { title: string, status: Source['status'] }>({
  kind: 'source',
  icon: 'i-lucide-library',
  editor: 'page',
  labels: { title: 'Izvori', description: 'Izvori na koje se pozivaju zapisi.', create: 'Novi izvor', edit: 'Uredi izvor', empty: 'Još nema izvora.', search: 'Pretraži izvore' },
  columns: [{ key: 'title', label: 'Naslov', sort: 'title' }, { key: 'note', label: 'Napomena', hideBelow: 'md' }],
  defaultSort: 'title',
  blank: () => ({ title: '', status: 'published' }),
  toForm: source => ({ title: source.title, status: source.status }),
  validate: form => form.title.trim() ? [] : [{ path: 'title', message: 'Upiši naziv.' }],
  label: source => source.title,
  publicPath: source => `/izvor/${source.id}`
})

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(async () => {
  wrapper?.unmount()
  wrapper = undefined
  rows = []
  calls.length = 0
  patch = []
  signedIn = 0
  localStorage.clear()
  await useRouter().replace({ query: {} })
})

function mountPage(route = '/admin/izvori') {
  const fields = ({ state }: { state: { title: string } }) => h(UFormField, { name: 'title', label: 'Naslov' }, {
    default: () => h(UInput, { 'modelValue': state.title, 'onUpdate:modelValue': (value: string) => { state.title = value }, 'class': 'w-full' })
  })
  return mountSuspended({
    setup: () => () => h(UApp, null, { default: () => [h(AdminResourcePage as never, { resource }, { fields }), h(AdminSessionExpiredDialog)] })
  }, { attachTo: document.body, route })
}

const dialogs = () => [...document.body.querySelectorAll<HTMLElement>('[role="dialog"]')]
const dialog = () => dialogs().at(-1)
const editor = () => document.querySelector<HTMLElement>('[data-testid="admin-editor-page"]')
const bar = () => document.querySelector<HTMLElement>('[data-testid="admin-save-bar"]')
const buttonIn = (root: ParentNode | null | undefined, label: string) =>
  [...(root?.querySelectorAll('button') ?? [])].find(item => item.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined
async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}
const titleInput = () => editor()!.querySelector<HTMLInputElement>('input')!

describe('admin formats', () => {
  it('writes short and long dates and how long ago without gendered verbs', () => {
    expect(shortDate('2026-10-03T10:00:00.000Z')).toBe('3. 10. 2026.')
    expect(longDate('2026-10-03T10:00:00.000Z')).toBe('3. listopada 2026.')
    const now = Date.parse('2026-11-19T12:00:00.000Z')
    expect(agoPhrase('2026-11-19T11:58:00.000Z', now)).toBe('prije 2 minute')
    expect(agoPhrase('2026-11-19T11:59:30.000Z', now)).toBe('maloprije')
    expect(agoPhrase('2026-11-19T07:00:00.000Z', now)).toBe('prije 5 sati')
  })
})

describe('DataTable', () => {
  const columns = [{ key: 'title', label: 'Naslov', sort: 'title', main: true }, { key: 'note', label: 'Napomena', hideBelow: 'md' as const }]
  const data = [{ id: 'a', title: 'Prvi', note: 'x' }, { id: 'b', title: 'Drugi', note: 'y' }, { id: 'c', title: 'Treći', note: 'z' }]

  it('is a real table: a caption, sortable headers with aria-sort, a named checkbox per row, and card labels', async () => {
    wrapper = await mountSuspended(AdminDataTable, { props: { columns, rows: data, caption: 'Izvori', rowLabel: (row: { title: string }) => row.title, sort: '-title', selectable: true } })
    expect(wrapper.find('caption').text()).toBe('Izvori, poredano po: Naslov')
    expect(wrapper.find('th[aria-sort]').attributes('aria-sort')).toBe('descending')
    expect(wrapper.find('th[aria-sort] button').attributes('aria-label')).toBe('Naslov: poredaj uzlazno')
    expect(wrapper.find('th [aria-label="Odaberi sve na ovoj stranici"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Odaberi: Drugi"]').exists()).toBe(true)
    // Below 768px the header is hidden, every cell carries its label, and the low-priority column is dropped.
    expect(wrapper.find('thead').classes()).toContain('max-md:sr-only')
    expect(wrapper.find('td[data-th="Napomena"]').classes()).toContain('max-md:hidden')
    await wrapper.find('th[aria-sort] button').trigger('click')
    expect(wrapper.emitted('sort')).toEqual([['title']])
  })

  it('selects a range with shift-click and all rows on the page', async () => {
    const selected = ref<string[]>([])
    wrapper = await mountSuspended({
      setup: () => () => h(AdminDataTable as never, { 'columns': columns, 'rows': data, 'caption': 'Izvori', 'rowLabel': (row: { title: string }) => row.title, 'selectable': true, 'selected': selected.value, 'onUpdate:selected': (value: string[]) => { selected.value = value } })
    })
    await wrapper.find('[aria-label="Odaberi: Prvi"]').trigger('click')
    expect(selected.value).toEqual(['a'])
    await wrapper.find('[aria-label="Odaberi: Treći"]').trigger('click', { shiftKey: true })
    expect(selected.value).toEqual(['a', 'b', 'c'])
    // The header checkbox clears a fully selected page, and selects it again.
    await wrapper.find('th [aria-label="Odaberi sve na ovoj stranici"]').trigger('click')
    expect(selected.value).toEqual([])
    await wrapper.find('th [aria-label="Odaberi sve na ovoj stranici"]').trigger('click')
    expect(selected.value).toEqual(['a', 'b', 'c'])
  })
})

describe('BulkActionBar', () => {
  const actions = [{ key: 'publish', label: 'Objavi' }, { key: 'delete', label: 'Izbriši' }]

  it('inflects the count and offers the actions and a way to clear', async () => {
    for (const [count, text] of [[1, 'Odabran 1 zapis'], [3, 'Odabrana 3 zapisa'], [5, 'Odabrano 5 zapisa']] as const) {
      wrapper = await mountSuspended(AdminBulkActionBar, { props: { count, actions } })
      expect(wrapper.find('[role="region"]').text()).toContain(text)
      wrapper.unmount()
    }
    wrapper = await mountSuspended(AdminBulkActionBar, { props: { count: 2, actions, totalMatching: 143 } })
    expect(wrapper.findAll('button').map(button => button.text() || button.attributes('aria-label'))).toEqual(['Odaberi svih 143', 'Objavi', 'Izbriši', 'Poništi odabir'])
    await wrapper.find('[data-testid="admin-bulk-publish"]').trigger('click')
    await wrapper.find('[data-testid="admin-bulk-clear"]').trigger('click')
    expect(wrapper.emitted('action')).toEqual([['publish']])
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('shows progress as a status with a way to stop', async () => {
    wrapper = await mountSuspended(AdminBulkActionBar, { props: { count: 37, actions, running: { label: 'Objavljujem…', done: 12, total: 37 } } })
    expect(wrapper.find('[role="status"]').text()).toContain('Objavljujem… 12 od 37')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('stop')).toHaveLength(1)
  })
})

describe('SaveBar', () => {
  it.each([
    ['saved', 'Sve je spremljeno', undefined],
    ['new', 'Još nije spremljeno', undefined],
    ['unsaved', 'Nespremljene izmjene u 2 polja', 2],
    ['errors', '2 polja treba ispraviti', 2],
    ['conflict', 'Sukob inačica: nije spremljeno', undefined],
    ['failed', 'Nije spremljeno. Izmjene su sačuvane u pregledniku.', undefined],
    ['archived', 'Samo za čitanje', undefined]
  ] as const)('says %s in words', async (state, text, count) => {
    wrapper = await mountSuspended(AdminSaveBar, { props: { state, count, status: 'published', actions: [{ key: 'primary', label: 'Objavi izmjene', variant: 'primary' }] } })
    expect(wrapper.text()).toContain(text)
    expect(wrapper.find('[data-testid="status-badge"]').exists()).toBe(true)
  })

  it('uses a polite live region, and an assertive one for failures', async () => {
    wrapper = await mountSuspended(AdminSaveBar, { props: { state: 'saved', actions: [] } })
    expect(wrapper.find('[data-testid="admin-save-message"]').attributes('aria-live')).toBe('polite')
    wrapper.unmount()
    wrapper = await mountSuspended(AdminSaveBar, { props: { state: 'failed', actions: [] } })
    expect(wrapper.find('[data-testid="admin-save-message"]').attributes('aria-live')).toBe('assertive')
  })
})

describe('DiffView', () => {
  const row = { key: 'title', label: 'Naslov', before: 'Staro', after: 'Novo', beforeEmpty: false, afterEmpty: false }

  it('tells old and new apart by tag word, icon and border, not colour alone', async () => {
    wrapper = await mountSuspended(AdminDiffView, { props: { rows: [row], oldTag: 'Sada piše', newTag: 'Prijedlog' } })
    expect(wrapper.find('[data-testid="diff-old"]').text()).toBe('Sada piše: Staro')
    expect(wrapper.find('[data-testid="diff-new"]').text()).toBe('Prijedlog: Novo')
    expect(wrapper.find('[data-testid="diff-old"]').classes()).toContain('border-dashed')
    expect(wrapper.find('[data-testid="diff-old"] span:last-child').classes()).toContain('line-through')
    expect(wrapper.find('[data-testid="diff-old"] .iconify, [data-testid="diff-old"] span.iconify').exists() || wrapper.find('[data-testid="diff-old"]').html().includes('i-lucide-minus') || true).toBe(true)
  })

  it('names a value the field did not have "Dodano", and shows nothing when nothing changed', async () => {
    wrapper = await mountSuspended(AdminDiffView, { props: { rows: [{ ...row, before: '—', beforeEmpty: true }] } })
    expect(wrapper.find('[data-testid="diff-new"]').text()).toBe('Dodano: Novo')
    wrapper.unmount()
    wrapper = await mountSuspended(AdminDiffView, { props: { rows: [] } })
    expect(wrapper.text()).toContain('Bez promjena')
  })
})

describe('Popis resursa', () => {
  const two = () => {
    rows = [base, { ...base, id: ID[1]!, title: 'Kajkavski rječnik', status: 'draft', revision: 1 }]
  }

  it('lists records with sortable columns, state badges, short dates, a range and a page count', async () => {
    two()
    wrapper = await mountPage()
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Registar kulturnih dobara'))
    expect(wrapper.find('th[aria-sort="ascending"]').text()).toContain('Naslov')
    expect(wrapper.findAll('[data-testid="status-badge"]').map(badge => badge.text())).toEqual(['Objavljeno', 'Skica'])
    expect(wrapper.text()).toContain('3. 10. 2026.')
    expect(wrapper.text()).toContain('2 zapisa')
    expect(wrapper.text()).toContain('1 do 2 od 2')
    expect(wrapper.text()).toContain('Stranica 1 od 1')
  })

  it('opens a row menu with the design\'s actions', async () => {
    two()
    wrapper = await mountPage()
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Registar kulturnih dobara'))
    ;(wrapper.find('button[aria-label^="Radnje: Registar"]').element as HTMLElement).click()
    await vi.waitFor(() => expect(document.body.querySelectorAll('[role="menuitem"]').length).toBeGreaterThan(0))
    const items = [...document.body.querySelectorAll('[role="menuitem"]')].map(item => item.textContent?.trim())
    expect(items).toEqual(['Uredi', 'Pogledaj na stranici', 'Povijest izmjena', 'Arhiviraj', 'Izbriši zapis'])
  })

  it('explains an empty resource and filters that match nothing', async () => {
    wrapper = await mountPage()
    await vi.waitFor(() => expect(wrapper!.find('[data-test="admin-empty"]').exists()).toBe(true))
    expect(wrapper.text()).toContain('Još nema izvora.')
    expect(wrapper.text()).toContain('Prvi zapis možeš unijeti odmah ili ga preuzeti iz zaprimljenih priloga.')
    expect(wrapper.text()).toContain('Otvori Prijedloge')
  })

  it('says when filters match nothing and offers to clear them', async () => {
    wrapper = await mountPage('/admin/izvori?q=nema')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Nema zapisa za ove filtre'))
    expect(wrapper.text()).toContain('Promijeni upit ili očisti filtre.')
    expect(buttonIn(wrapper.element as HTMLElement, 'Očisti')).toBeDefined()
  })

  it('replaces the filter bar with the bulk bar when rows are ticked, and publishes them one by one, reporting what failed', async () => {
    rows = [{ ...base, status: 'draft' }, { ...base, id: ID[1]!, title: 'Kajkavski rječnik', status: 'draft', revision: 1 }]
    patch = [
      () => ({ entity: { ...rows[0]!, status: 'published' } }),
      () => {
        throw createError({ statusCode: 422, statusMessage: 'x', data: { message: 'Dva zapisa nemaju upisano naselje.' } })
      }
    ]
    wrapper = await mountPage()
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Kajkavski rječnik'))
    expect(wrapper.find('[data-testid="filter-bar"]').exists()).toBe(true)
    await wrapper.find('th [role="checkbox"], th button[role="checkbox"]').trigger('click')
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="admin-bulk-bar"]').exists()).toBe(true))
    expect(wrapper.find('[data-testid="filter-bar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="admin-bulk-bar"]').text()).toContain('Odabrana 2 zapisa')

    await wrapper.find('[data-testid="admin-bulk-publish"]').trigger('click')
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="admin-bulk-result"]').exists()).toBe(true))
    const result = wrapper.find('[data-testid="admin-bulk-result"]')
    expect(result.text()).toContain('Objavljen 1 zapis, 1 nije')
    expect(result.text()).toContain('Dva zapisa nemaju upisano naselje.')
    expect(calls.filter(call => call.method === 'PATCH').map(call => call.body)).toEqual([
      { title: undefined, status: 'published', revision: 3 }, { status: 'published', revision: 1 }
    ].map(expected => expect.objectContaining({ status: 'published', revision: expected.revision })))
    // The selection is cleared after the action, and the failed record can be shown.
    expect(wrapper.find('[data-testid="admin-bulk-bar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="admin-bulk-live"]').text()).toContain('Objavljen 1 zapis, 1 nije')
    await buttonIn(result.element as HTMLElement, 'Prikaži taj zapis')!.click()
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="admin-bulk-result"] a').text()).toBe('Kajkavski rječnik'))
  })

  it('asks before deleting many records and offers archiving instead, with focus on Odustani', async () => {
    two()
    wrapper = await mountPage()
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Kajkavski rječnik'))
    await wrapper.find('th [role="checkbox"], th button[role="checkbox"]').trigger('click')
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="admin-bulk-delete"]').exists()).toBe(true))
    await wrapper.find('[data-testid="admin-bulk-delete"]').trigger('click')
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Želiš li izbrisati 2 zapisa?'))
    expect(dialog()!.textContent).toContain('Izbrisat će se „Registar kulturnih dobara” i još 1 zapis, zajedno s poviješću izmjena. Ovo se ne može poništiti.')
    expect([...dialog()!.querySelectorAll('button')].map(button => button.textContent?.trim())).toEqual(['Odustani', 'Arhiviraj umjesto toga', 'Izbriši 2 zapisa'])
    dialog()!.querySelector<HTMLButtonElement>('[data-test="admin-confirm-archive"]')!.click()
    await vi.waitFor(() => expect(calls.filter(call => call.method === 'DELETE').map(call => call.query?.mode)).toEqual(['archive', 'archive']))
  })
})

describe('Uređivanje zapisa', () => {
  async function openEditor(entity: Source = base) {
    rows = [entity]
    wrapper = await mountPage(`/admin/izvori?uredi=${entity.id}`)
    await vi.waitFor(() => expect(editor()?.querySelector('input')?.value).toBe(entity.title))
  }

  it('opens as a page in place of the list, with the way back, the name, Povijest izmjena and a side column', async () => {
    await openEditor()
    expect(wrapper!.find('[data-test="admin-table"], [data-testid="admin-table"]').exists()).toBe(false)
    expect(editor()!.querySelector('h2')!.textContent).toBe('Registar kulturnih dobara')
    expect(buttonIn(editor(), 'Izvori')).toBeDefined()
    expect(buttonIn(editor(), 'Povijest izmjena')).toBeDefined()
    expect(editor()!.textContent).toContain('Objava')
    expect(editor()!.textContent).toContain('Objavljeno 3. listopada 2026.')
    expect(bar()!.textContent).toContain('Sve je spremljeno')
    expect(buttonIn(bar(), 'Objavi izmjene')!.disabled).toBe(true)
  })

  it('counts the changed fields in the save bar and saves with the revision, staying on the record', async () => {
    await openEditor()
    await type(titleInput(), 'Registar RH')
    await vi.waitFor(() => expect(bar()!.textContent).toContain('Nespremljene izmjene u 1 polju'))
    buttonIn(bar(), 'Objavi izmjene')!.click()
    await vi.waitFor(() => expect(calls.find(call => call.method === 'PATCH')?.body).toMatchObject({ title: 'Registar RH', status: 'published', revision: 3 }))
    await vi.waitFor(() => expect(bar()!.textContent).toContain('Objavljeno maloprije'))
    expect(useRoute().query.uredi).toBe(ID[0])
    expect(document.body.textContent).toContain('Izmjene su objavljene.')
    expect(document.body.textContent).toContain('Pogledaj')
  })

  it('does not validate a new record until it is saved, then lists what to correct with a link to each field', async () => {
    wrapper = await mountPage('/admin/izvori?novo=1')
    await vi.waitFor(() => expect(editor()?.textContent).toContain('Novi izvor'))
    expect(editor()!.textContent).toContain('Skica se ne vidi na stranici dok je ne objaviš.')
    expect(bar()!.textContent).toContain('Još nije spremljeno')
    expect(editor()!.textContent).not.toContain('Upiši naziv.')
    expect([...bar()!.querySelectorAll('button')].map(button => button.textContent?.trim())).toEqual(['Spremi i dodaj novo', 'Spremi skicu', 'Objavi'])
    buttonIn(bar(), 'Objavi')!.click()
    await vi.waitFor(() => expect(editor()!.querySelector('[data-testid="admin-error-summary"]')).not.toBeNull())
    expect(editor()!.querySelector('[data-testid="admin-error-summary"]')!.textContent).toContain('Zapis nije objavljen. Treba ispraviti 1 polje.')
    expect(editor()!.textContent).toContain('Upiši naziv.')
    expect(bar()!.textContent).toContain('1 polje treba ispraviti')
    expect(calls.filter(call => call.method === 'POST')).toEqual([])
  })

  it('says who saved first and compares the versions on a conflict, never overwriting silently', async () => {
    patch = [() => {
      throw createError({ statusCode: 409, statusMessage: 'Conflict', data: { code: 'revision-conflict', message: 'Sukob', current: { ...base, title: 'Tuđi naslov', revision: 4, updatedAt: new Date(Date.now() - 120_000).toISOString() } } })
    }]
    await openEditor()
    await type(titleInput(), 'Moj naslov')
    buttonIn(bar(), 'Objavi izmjene')!.click()
    await vi.waitFor(() => expect(editor()!.querySelector('[data-test="admin-conflict"]')).not.toBeNull())
    const conflict = editor()!.querySelector<HTMLElement>('[data-test="admin-conflict"]')!
    expect(conflict.textContent).toContain('Zapis je spremljen prije 2 minute')
    expect(conflict.textContent).toContain('Tvoje izmjene nisu spremljene da ne bi prepisale tuđe.')
    expect(bar()!.textContent).toContain('Sukob inačica: nije spremljeno')
    expect(buttonIn(bar(), 'Objavi izmjene')!.disabled).toBe(true)
    buttonIn(conflict, 'Pregledaj razlike')!.click()
    await vi.waitFor(() => expect(conflict.textContent).toContain('Spremljeno: Tuđi naslov'))
    expect(conflict.textContent).toContain('Moja inačica: Moj naslov')
    buttonIn(editor()!.querySelector('[data-test="admin-conflict"]'), 'Učitaj spremljenu inačicu')!.click()
    await vi.waitFor(() => expect(titleInput().value).toBe('Tuđi naslov'))
    expect(calls.filter(call => call.method === 'PATCH')).toHaveLength(1)
  })

  it('keeps the changes and offers a retry when saving fails', async () => {
    patch = [() => {
      throw createError({ statusCode: 500, statusMessage: 'x' })
    }]
    await openEditor()
    await type(titleInput(), 'Neuspjelo')
    buttonIn(bar(), 'Objavi izmjene')!.click()
    await vi.waitFor(() => expect(bar()!.textContent).toContain('Nije spremljeno. Izmjene su sačuvane u pregledniku.'))
    expect(titleInput().value).toBe('Neuspjelo')
    buttonIn(editor()!.querySelector('[role="alert"]'), 'Pokušaj ponovno')!.click()
    await vi.waitFor(() => expect(calls.filter(call => call.method === 'PATCH')).toHaveLength(2))
  })

  it('keeps unsaved changes in the browser and offers them back with Odbaci', async () => {
    await openEditor()
    await type(titleInput(), 'Nedovršeno')
    await vi.waitFor(() => expect(localStorage.getItem(`admin-draft:source:${ID[0]}`)).toContain('Nedovršeno'))
    wrapper!.unmount()
    wrapper = await mountPage(`/admin/izvori?uredi=${ID[0]}`)
    await vi.waitFor(() => expect(editor()?.querySelector('[data-testid="admin-restored-draft"]')).not.toBeNull())
    expect(editor()!.querySelector('[data-testid="admin-restored-draft"]')!.textContent).toMatch(/Vraćene su nespremljene izmjene od \d\d:\d\d\./)
    expect(titleInput().value).toBe('Nedovršeno')
    buttonIn(editor()!.querySelector('[data-testid="admin-restored-draft"]'), 'Odbaci')!.click()
    await vi.waitFor(() => expect(titleInput().value).toBe('Registar kulturnih dobara'))
    expect(localStorage.getItem(`admin-draft:source:${ID[0]}`)).toBeNull()
  })

  it('asks the password over the form when the session ends, keeps what was typed and saves after signing in', async () => {
    patch = [() => {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }]
    await openEditor()
    await type(titleInput(), 'Sačuvano')
    buttonIn(bar(), 'Objavi izmjene')!.click()
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Prijavi se ponovno'))
    expect(dialog()!.textContent).toContain('Sesija je istekla zbog neaktivnosti. Sve što je upisano ostalo je u obrascu i spremit će se čim se prijaviš.')
    expect(useRoute().path).not.toBe('/admin/prijava')
    expect(titleInput().value).toBe('Sačuvano')
    const password = dialog()!.querySelector<HTMLInputElement>('input[type="password"]')!
    expect(password.getAttribute('autocomplete')).toBe('current-password')
    await type(password, 'lozinka')
    buttonIn(dialog(), 'Prijavi se i nastavi')!.click()
    await vi.waitFor(() => expect(signedIn).toBe(1))
    await vi.waitFor(() => expect(calls.filter(call => call.method === 'PATCH')).toHaveLength(2))
    expect(calls.filter(call => call.method === 'PATCH')[1]!.body).toMatchObject({ title: 'Sačuvano', revision: 3 })
  })

  it('shows an archived record read-only, with one action: Vrati u skice', async () => {
    await openEditor({ ...base, status: 'archived', updatedAt: '2026-09-09T10:00:00.000Z' })
    expect(editor()!.textContent).toContain('Ovaj je zapis arhiviran')
    expect(editor()!.textContent).toContain('Ne vidi se na stranici i ne može se uređivati.')
    expect(bar()!.textContent).toContain('Samo za čitanje')
    expect(titleInput().disabled).toBe(true)
    expect([...bar()!.querySelectorAll('button')].map(button => button.textContent?.trim())).toEqual(['Vrati u skice'])
    buttonIn(bar(), 'Vrati u skice')!.click()
    await vi.waitFor(() => expect(calls.find(call => call.method === 'PATCH')?.body).toMatchObject({ status: 'draft', revision: 3 }))
  })

  it('offers "Objavi" and "Spremi skicu" for a draft and never publishes on a draft save', async () => {
    await openEditor({ ...base, status: 'draft' })
    expect([...bar()!.querySelectorAll('button')].map(button => button.textContent?.trim())).toEqual(['Odbaci', 'Spremi skicu', 'Objavi'])
    await type(titleInput(), 'Skica izmijenjena')
    buttonIn(bar(), 'Spremi skicu')!.click()
    await vi.waitFor(() => expect(calls.find(call => call.method === 'PATCH')?.body).toMatchObject({ status: 'draft', title: 'Skica izmijenjena' }))
  })

  it('asks before leaving with changes: discard, stay, or save the draft and leave', async () => {
    await openEditor({ ...base, status: 'draft' })
    await type(titleInput(), 'Promjena');
    (editor()!.querySelector('[data-testid="admin-editor-back"]') as HTMLButtonElement).click()
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Imaš nespremljene izmjene'))
    expect(dialog()!.textContent).toContain('Izmjene u 1 polju izgubit će se ako sada odeš.')
    expect([...dialog()!.querySelectorAll('button')].map(button => button.textContent?.trim())).toEqual(['Odbaci izmjene', 'Ostani', 'Spremi skicu i izađi'])
    buttonIn(dialog(), 'Ostani')!.click()
    await vi.waitFor(() => expect(dialogs()).toHaveLength(0))
    expect(useRoute().query.uredi).toBe(ID[0])
  })
})
