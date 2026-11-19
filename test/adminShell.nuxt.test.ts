import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { UApp } from '#components'
import AdminNavList from '../app/components/admin/NavList.vue'
import AdminBottomBar from '../app/components/admin/BottomBar.vue'
import AdminDashboardCard from '../app/components/admin/DashboardCard.vue'
import AdminDashboard from '../app/pages/admin/index.vue'
import AdminSignIn from '../app/pages/admin/prijava.vue'
import { ADMIN_NAV, ADMIN_NAV_GROUPS, adminNavActive } from '../app/utils/adminNav'
import { daysWithoutPin } from '../app/composables/useAdminDashboard'

// The admin shell (navigation, pending badge), the dashboard and the sign-in page.

let pending = 7
registerEndpoint('/api/admin/session', () => ({ authenticated: true }))
registerEndpoint('/api/admin/inbox/summary', () => ({ pending }))

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(async () => {
  wrapper?.unmount()
  wrapper = undefined
  pending = 7
  await useRouter().replace({ path: '/', query: {} })
})

function mountInApp(component: unknown, route = '/admin') {
  return mountSuspended({ setup: () => () => h(UApp, null, { default: () => h(component as never) }) }, { attachTo: document.body, route })
}

describe('admin navigation', () => {
  it('has the four fixed groups, and every entry once', () => {
    expect(ADMIN_NAV_GROUPS.map(group => group.label)).toEqual(['Rad', 'Sadržaj', 'Igra i učenje', 'Šifrarnici i građa'])
    const paths = ADMIN_NAV.map(item => item.to)
    expect(new Set(paths).size).toBe(paths.length)
    expect(paths).toContain('/admin/prijedlozi')
    expect(paths).toContain('/admin/povijest')
  })

  it('marks the dashboard only on /admin and a resource for its sub-paths', () => {
    const [dashboard, , , , , baština] = [ADMIN_NAV_GROUPS[0]!.items[0]!, ...ADMIN_NAV_GROUPS[1]!.items]
    expect(adminNavActive(dashboard, '/admin')).toBe(true)
    expect(adminNavActive(dashboard, '/admin/bastina')).toBe(false)
    expect(adminNavActive(baština!, '/admin/osobe')).toBe(false)
    expect(adminNavActive(ADMIN_NAV_GROUPS[1]!.items[1]!, '/admin/bastina/')).toBe(true)
  })

  it('shows the pending count beside the inbox with the full phrase as its accessible text, in every group list', async () => {
    wrapper = await mountInApp(AdminNavList, '/admin/bastina')
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="admin-pending"]').exists()).toBe(true))
    expect(wrapper.find('[data-testid="admin-pending"]').text()).toBe('7 priloga čeka pregled')
    expect(wrapper.find('a[aria-current="page"]').text()).toContain('Baština')
    const headings = wrapper.findAll('h2').map(heading => heading.text())
    expect(headings).toEqual(['Rad', 'Sadržaj', 'Igra i učenje', 'Šifrarnici i građa'])
  })

  it('leaves no badge at zero', async () => {
    pending = 0
    wrapper = await mountInApp(AdminNavList)
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Prijedlozi'))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(wrapper.find('[data-testid="admin-pending"]').exists()).toBe(false)
  })

  it('has a phone bottom bar of four, with the badge on Zaprimljeno', async () => {
    wrapper = await mountInApp(AdminBottomBar)
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="admin-pending-phone"]').exists()).toBe(true))
    const bar = wrapper.find('[data-testid="admin-bottom-bar"]')
    expect(bar.findAll('a, button').map(item => item.text().replace(/\d+ priloga čeka pregled/, '').trim())).toEqual(['Ploča', 'Zaprimljeno', 'Sadržaj', 'Račun'])
    expect(wrapper.find('[data-testid="admin-pending-phone"]').text()).toBe('7 priloga čeka pregled')
  })
})

describe('DashboardCard', () => {
  it('reads the number and the label as one phrase and outlines the urgent one in ink', async () => {
    wrapper = await mountSuspended(AdminDashboardCard, { props: { to: '/admin/prijedlozi', count: 7, label: 'priloga čeka pregled', detail: '3 ispravka', attention: true } })
    expect(wrapper.find('a').attributes('href')).toBe('/admin/prijedlozi')
    // The visible number is hidden from assistive technology and repeated in hidden text, so the link reads "7 priloga čeka pregled".
    expect(wrapper.find('.sr-only').text()).toBe('7')
    expect(wrapper.text()).toContain('priloga čeka pregled')
    expect(wrapper.text()).toContain('3 ispravka')
    expect(wrapper.find('a').classes()).toContain('border-2')
    expect(wrapper.find('[aria-hidden="true"]').text()).toBe('7')
  })
})

describe('daily word gaps', () => {
  it('counts the coming days that have no pinned word', () => {
    const pins = [{ day: '2026-11-20' }, { day: '2026-11-22' }] as never
    const gaps = daysWithoutPin({ day: '2026-11-19', pins }, 4)
    expect(gaps).toEqual(['2026-11-21', '2026-11-23'])
  })
})

describe('Nadzorna ploča', () => {
  function endpoints(overrides: { inbox?: unknown, history?: unknown, areas?: number, needsUpdate?: number, draftAge?: number } = {}) {
    const old = new Date(Date.now() - 45 * 86_400_000).toISOString()
    registerEndpoint('/api/admin/inbox', () => overrides.inbox ?? ({
      rows: [{ type: 'correction' }, { type: 'correction' }, { type: 'word' }], total: 3, page: 1, size: 100, counts: { pending: 3 }
    }))
    registerEndpoint('/api/review/daily', () => ({
      day: '2026-11-19', today: { headword: 'kaj' }, recent: [], pins: [{ day: '2026-11-20', headword: 'štenge' }], runway: { readyUnused: 1, unused: 1, active: 1, daysLeft: 1 }, warnings: []
    }))
    registerEndpoint('/api/admin/history', () => overrides.history ?? ({
      rows: [{ id: 1, kind: 'heritage_item', entityId: 'e1', revision: 2, action: 'update', actor: 'admin', createdAt: '2026-11-18T10:00:00.000Z', submissionId: null, label: 'Crkva sv. Ane', registered: true }], total: 1, page: 1, size: 6
    }))
    const content = (kind: string, query: Record<string, string>) => {
      if (kind === 'area') return { rows: [], total: overrides.areas ?? 5, page: 1, size: 25 }
      if (query.verification === 'needs_update') return { rows: [], total: kind === 'heritage_item' ? (overrides.needsUpdate ?? 12) : 0, page: 1, size: 25 }
      if (query.status === 'draft') return { rows: kind === 'person' ? Array.from({ length: overrides.draftAge ?? 5 }, (_, index) => ({ id: String(index), updatedAt: old })) : [], total: 0, page: 1, size: 100 }
      return { rows: [], total: 0, page: 1, size: 25 }
    }
    for (const kind of ['area', 'heritage_item', 'person', 'club', 'word', 'story', 'custom', 'folk_text']) {
      registerEndpoint(`/api/admin/content/${kind}`, (event) => {
        const url = new URL((event as unknown as { path: string }).path.replace(/^\/_/, ''), 'http://localhost')
        return content(kind, Object.fromEntries(url.searchParams))
      })
    }
  }

  it('says what needs an editor today, most urgent first, with counts that are links', async () => {
    endpoints()
    wrapper = await mountInApp(AdminDashboard)
    await vi.waitFor(() => expect(wrapper!.findAll('[data-testid="admin-dashboard-card"]')).toHaveLength(4))
    const cards = wrapper.findAll('[data-testid="admin-dashboard-card"]')
    expect(cards[0]!.text()).toContain('priloga čekaju pregled')
    expect(cards[0]!.text()).toContain('2 ispravka · 1 riječ')
    expect(cards[0]!.attributes('data-attention')).toBe('true')
    expect(cards[1]!.text()).toContain('zapisa treba ažurirati')
    expect(cards[1]!.text()).toContain('12')
    expect(cards[1]!.attributes('href')).toContain('/admin/bastina')
    expect(cards[1]!.attributes('href')).toContain('verification=needs_update')
    expect(cards[2]!.text()).toContain('skica starijih od 30 dana')
    expect(cards[2]!.attributes('href')).toContain('/admin/osobe')
    expect(cards[3]!.text()).toContain('dana bez prikvačene riječi')
    expect(wrapper.text()).toContain('Nedavne izmjene')
    expect(wrapper.text()).toContain('Crkva sv. Ane')
    expect(wrapper.text()).toContain('štenge')
  })

  it('says everything is reviewed when nothing waits', async () => {
    endpoints({
      inbox: { rows: [], total: 0, page: 1, size: 100, counts: { pending: 0 } },
      needsUpdate: 0,
      draftAge: 0
    })
    registerEndpoint('/api/review/daily', () => ({
      day: '2026-11-19', today: { headword: 'kaj' }, recent: [],
      pins: Array.from({ length: 14 }, (_, index) => ({ day: new Date(Date.UTC(2026, 10, 20 + index)).toISOString().slice(0, 10), headword: 'x' })),
      runway: { readyUnused: 1, unused: 1, active: 1, daysLeft: 1 }, warnings: []
    }))
    wrapper = await mountInApp(AdminDashboard)
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="admin-dashboard-clear"]').exists()).toBe(true))
    expect(wrapper.text()).toContain('Sve je pregledano')
    expect(wrapper.text()).toContain('Nema zaprimljenih priloga, zastarjelih zapisa ni praznina u rasporedu riječi dana.')
  })

  it('keeps the counts and says so when only the recent changes failed to load', async () => {
    endpoints()
    registerEndpoint('/api/admin/history', () => {
      throw createError({ statusCode: 500, statusMessage: 'x' })
    })
    wrapper = await mountInApp(AdminDashboard)
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="admin-dashboard-partial"]').exists()).toBe(true))
    expect(wrapper.find('[data-testid="admin-dashboard-partial"]').text()).toContain('Nedavne izmjene nismo uspjeli učitati')
    expect(wrapper.find('[data-testid="admin-dashboard-partial"]').text()).toContain('Brojevi gore su točni.')
    expect(wrapper.findAll('[data-testid="admin-dashboard-card"]')).toHaveLength(4)
  })

  it('welcomes an empty archive with the first step', async () => {
    endpoints({ areas: 0 })
    wrapper = await mountInApp(AdminDashboard)
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="admin-dashboard-first-time"]').exists()).toBe(true))
    expect(wrapper.text()).toContain('Arhiv je još prazan')
    expect(wrapper.text()).toContain('Unesi mjesta')
  })
})

describe('Prijava', () => {
  const posts: unknown[] = []
  let status = 0
  registerEndpoint('/api/admin/session', {
    method: 'POST',
    handler: async (event) => {
      posts.push(await (event as unknown as { web: { request: Request } }).web.request.json())
      if (status) throw createError({ statusCode: status, statusMessage: 'x' })
      return { authenticated: true }
    }
  })
  afterEach(() => {
    posts.length = 0
    status = 0
  })

  const form = () => wrapper!.find('form')
  const password = () => wrapper!.find<HTMLInputElement>('input[data-testid="admin-login-password"], [data-testid="admin-login-password"] input, input[type="password"], input[autocomplete="current-password"]')

  it('is one card with the copy of the design, and the password manager attributes', async () => {
    wrapper = await mountInApp(AdminSignIn, '/admin/prijava')
    expect(wrapper.text()).toContain('Potkalnički zapisi · urednik')
    expect(wrapper.find('h1').text()).toBe('Prijava')
    expect(password().attributes('autocomplete')).toBe('current-password')
    expect(password().attributes('type')).toBe('password')
    expect(wrapper.text()).toContain('Urednički dio nije javan. Tražiš arhiv?')
    expect(wrapper.text()).toContain('Na početnu')
    expect(wrapper.find('button[type="submit"]').text()).toBe('Prijavi se')
    // No second method is offered: no e-mail field and no link by e-mail.
    expect(wrapper.find('input[type="email"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('poveznicu za prijavu')
  })

  it('shows and hides the password', async () => {
    wrapper = await mountInApp(AdminSignIn, '/admin/prijava')
    await wrapper.find('button[aria-label="Prikaži lozinku"]').trigger('click')
    expect(password().attributes('type')).toBe('text')
    expect(wrapper.find('button[aria-label="Sakrij lozinku"]').attributes('aria-pressed')).toBe('true')
  })

  it('asks for the password when it is empty, without sending anything', async () => {
    wrapper = await mountInApp(AdminSignIn, '/admin/prijava')
    await form().trigger('submit')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Upiši lozinku.'))
    expect(posts).toEqual([])
  })

  it('says the sign-in failed without saying more when the password is wrong', async () => {
    status = 401
    wrapper = await mountInApp(AdminSignIn, '/admin/prijava')
    await password().setValue('pogrešna')
    await form().trigger('submit')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Prijava nije uspjela'))
    expect(wrapper.text()).toContain('Lozinka nije točna. Pokušaj ponovno.')
    expect(posts).toEqual([{ password: 'pogrešna' }])
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(password().element.value).toBe('')
  })

  it('names the lock-out the server reports, without any rule of its own', async () => {
    status = 429
    wrapper = await mountInApp(AdminSignIn, '/admin/prijava')
    await password().setValue('x')
    await form().trigger('submit')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Previše pokušaja'))
    expect(wrapper.text()).toContain('Radi sigurnosti prijava je zaustavljena na 15 minuta.')
  })

  it('tells a visitor who arrives after the session ended', async () => {
    wrapper = await mountInApp(AdminSignIn, '/admin/prijava?razlog=istekla')
    expect(wrapper.text()).toContain('Sesija je istekla')
    expect(wrapper.text()).toContain('Vratit ćemo te na stranicu na kojoj je rad stao.')
  })
})
