import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import HeritageItem from '../app/pages/bastina/[naselje]/[slug].vue'
import Contribute from '../app/pages/doprinesi/index.vue'
import { heritageItemByRoute } from './helpers/atlasFixtures'
import { registerAtlasApiEndpoints } from './helpers/registerAtlasApi'

registerAtlasApiEndpoints()

const posted: Record<string, unknown>[] = []
registerEndpoint('/api/submissions', {
  method: 'POST',
  handler: async (event) => {
    posted.push(await (event as unknown as { web: { request: Request } }).web.request.json())
    return { ok: true }
  }
})

afterEach(() => {
  posted.length = 0
})

describe('heritage correction flow', () => {
  const item = heritageItemByRoute('kalnik', 'crkva-sv-brcka')!

  it('opens the correction dialog from an item page, with the last edit date', async () => {
    const page = await mountSuspended(HeritageItem, {
      route: { path: '/bastina/kalnik/crkva-sv-brcka', params: { naselje: 'kalnik', slug: 'crkva-sv-brcka' } },
      attachTo: document.body
    })
    await vi.waitFor(() => expect(page.find('[data-testid="heritage-suggest-correction"]').exists()).toBe(true))
    expect(page.find('[data-testid="heritage-updated"]').text()).toContain('Zadnja izmjena')
    await page.find('[data-testid="heritage-suggest-correction"]').trigger('click')
    await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"] [data-testid="suggest-form"]')).not.toBeNull())
    const heading = document.body.querySelector('[data-testid="suggest-heading"]')!.textContent
    expect(heading).toContain(item.name)
    const name = document.body.querySelector<HTMLInputElement>('[role="dialog"] input[name="p.name"], [role="dialog"] input')!
    expect(name.value).toBe(item.name)
    page.unmount()
  })

  it('offers "Dodaj izvor" as a source proposal', async () => {
    const page = await mountSuspended(HeritageItem, {
      route: { path: '/bastina/kalnik/crkva-sv-brcka', params: { naselje: 'kalnik', slug: 'crkva-sv-brcka' } },
      attachTo: document.body
    })
    await vi.waitFor(() => expect(page.find('[data-testid="heritage-suggest-source"]').exists()).toBe(true))
    await page.find('[data-testid="heritage-suggest-source"]').trigger('click')
    await vi.waitFor(() => expect(document.body.querySelector('[data-testid="suggest-heading"]')).not.toBeNull())
    expect(document.body.querySelector('[data-testid="suggest-heading"]')!.textContent).toContain('Izvor ili literatura')
    page.unmount()
  })

  it('resolves an old correction link into the structured correction form', async () => {
    const page = await mountSuspended(Contribute, {
      route: `/doprinesi?vrsta=ispravak&zapis=${item.id}`
    })
    await vi.waitFor(() => expect(page.find('[data-testid="suggest-form"]').exists()).toBe(true))
    expect(page.find('[data-testid="suggest-heading"]').text()).toContain(item.name)
    expect((page.find('input').element as HTMLInputElement).value).toBe(item.name)
  })

  it('says so when the correction target does not exist', async () => {
    const page = await mountSuspended(Contribute, {
      route: '/doprinesi?vrsta=ispravak&sadrzaj=heritage_item&id=no-such-item'
    })
    await vi.waitFor(() => expect(page.text()).toContain('ne možemo otvoriti'))
  })
})

describe('/doprinesi cards', () => {
  it('lists the new cards and links them to the structured forms', async () => {
    const page = await mountSuspended(Contribute, { route: '/doprinesi' })
    for (const kind of ['word', 'memory', 'heritage_item', 'area', 'source', 'correction']) {
      expect(page.find(`[data-testid="contribute-card-${kind}"]`).exists()).toBe(true)
    }
    expect(page.find('[data-testid="contribute-card-heritage_item"]').attributes('href')).toContain('vrsta=prijedlog')
    expect(page.find('[data-testid="contribute-card-correction"]').attributes('href')).toContain('vrsta=ispravak')
  })

  it('searches for what to correct', async () => {
    const page = await mountSuspended(Contribute, { route: '/doprinesi?vrsta=ispravak' })
    await vi.waitFor(() => expect(page.find('[data-testid="suggest-picker"]').exists()).toBe(true))
    await page.find('[data-testid="suggest-picker"] input').setValue('Kalnik')
    await vi.waitFor(() => expect(page.find('[data-testid="suggest-pick-area"]').exists()).toBe(true), { timeout: 3000 })
  })

  it('prefills a proposal from the settlement of the link', async () => {
    const page = await mountSuspended(Contribute, {
      route: '/doprinesi?vrsta=prijedlog&sadrzaj=heritage_item&naselje=kalnik'
    })
    await vi.waitFor(() => expect(page.find('[data-testid="suggest-form"]').exists()).toBe(true))
    await vi.waitFor(() => expect(page.text()).toContain('Kalnik'))
  })
})
