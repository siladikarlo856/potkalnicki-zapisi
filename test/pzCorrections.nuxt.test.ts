import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import HeritageItem from '../app/pages/potkalnicko-prigorje/bastina/[naselje]/[slug].vue'
import Contribute from '../app/pages/potkalnicko-prigorje/doprinesi/index.vue'
import { heritageItemByRoute } from '../shared/utils/atlasData'

describe('heritage correction flow', () => {
  const item = heritageItemByRoute('kalnik', 'crkva-sv-brcka')!

  it('links an item page to the prefilled correction form', async () => {
    const page = await mountSuspended(HeritageItem, { route: '/potkalnicko-prigorje/bastina/kalnik/crkva-sv-brcka' })
    const link = page.find('[data-testid="heritage-suggest-correction"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toContain('vrsta=ispravak')
    expect(link.attributes('href')).toContain(`zapis=${item.id}`)
  })

  it('prefills the correction form from query parameters', async () => {
    const page = await mountSuspended(Contribute, {
      route: `/potkalnicko-prigorje/doprinesi?vrsta=ispravak&zapis=${item.id}`
    })
    expect(page.find('[data-testid="contribute-form"]').exists()).toBe(true)
    expect(page.text()).toContain(item.name)
    const textarea = page.find('textarea')
    expect(textarea.exists()).toBe(true)
    expect((textarea.element as HTMLTextAreaElement).value).toContain(item.name)
    expect((textarea.element as HTMLTextAreaElement).value).toContain('Predloženi ispravak:')
  })
})
