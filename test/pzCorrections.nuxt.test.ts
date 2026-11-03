import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import HeritageItem from '../app/pages/potkalnicko-prigorje/bastina/[naselje]/[slug].vue'
import Contribute from '../app/pages/potkalnicko-prigorje/doprinesi/index.vue'
import { heritageItemByRoute } from '../shared/utils/atlasData'
import { registerAtlasApiEndpoints } from './helpers/registerAtlasApi'

registerAtlasApiEndpoints()

describe('heritage correction flow', () => {
  const item = heritageItemByRoute('kalnik', 'crkva-sv-brcka')!

  it('links an item page to the prefilled correction form', async () => {
    const page = await mountSuspended(HeritageItem, {
      route: { path: '/potkalnicko-prigorje/bastina/kalnik/crkva-sv-brcka', params: { naselje: 'kalnik', slug: 'crkva-sv-brcka' } }
    })
    await vi.waitFor(() => expect(page.find('[data-testid="heritage-suggest-correction"]').exists()).toBe(true))
    const link = page.find('[data-testid="heritage-suggest-correction"]')
    expect(link.attributes('href')).toContain('vrsta=ispravak')
    expect(link.attributes('href')).toContain(`zapis=${item.id}`)
  })

  it('prefills the correction form from query parameters', async () => {
    registerEndpoint('/api/content/target', () => ({
      kind: 'heritage_item' as const,
      item: {
        ref: item.id,
        id: 'test-id',
        slug: item.slug,
        name: item.name,
        category: { key: 'church', label: 'Crkva' },
        municipality: { id: 'm', slug: 'opcina-kalnik', label: 'Općina Kalnik' },
        settlement: { id: 's', slug: 'kalnik', name: 'Kalnik' },
        locality: null,
        verification: 'unverified' as const,
        noindex: false,
        path: `/potkalnicko-prigorje/bastina/kalnik/${item.slug}`
      }
    }))
    const page = await mountSuspended(Contribute, {
      route: `/potkalnicko-prigorje/doprinesi?vrsta=ispravak&zapis=${item.id}`
    })
    await vi.waitFor(() => expect(page.find('[data-testid="contribute-form"]').exists()).toBe(true))
    expect(page.text()).toContain(item.name)
    const textarea = page.find('textarea')
    expect(textarea.exists()).toBe(true)
    expect((textarea.element as HTMLTextAreaElement).value).toContain(item.name)
    expect((textarea.element as HTMLTextAreaElement).value).toContain('Predloženi ispravak:')
  })
})
