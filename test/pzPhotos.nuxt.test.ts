import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import PzHeritageCard from '../app/components/pz/PzHeritageCard.vue'
import HeritageItem from '../app/pages/potkalnicko-prigorje/bastina/[naselje]/[slug].vue'
import PhotoCredits from '../app/pages/potkalnicko-prigorje/o-projektu/fotografije.vue'
import { buildPublicContent, type ItemImageRow } from '../server/utils/publicContent'
import { heritageItemDetail, photoCredits, resolveHeritageItem } from '../server/utils/publicAtlas'
import { fakeRowsWithIntangible } from './helpers/fakeIntangible'

// Heritage photos on the public site: every full photo carries its credit (author, licence linked to its deed,
// source), cards carry a one-line credit, and the credits page lists them all.
const MEDIA = 'https://abc.supabase.co'
const base = buildPublicContent(fakeRowsWithIntangible(), {})
const brcko = resolveHeritageItem(base, 'kalnik', 'crkva-sv-brcka')
if (brcko.status !== 'ok') throw new Error('fixture item crkva-sv-brcka is missing')
const file = (n: number) => `heritage/00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const image = (position: number, row: Partial<ItemImageRow> = {}): ItemImageRow => ({
  item_id: brcko.value.id, position, path: `${file(position + 1)}.webp`, thumb_path: `${file(position + 1)}-thumb.webp`,
  width: 1600, height: 1200, alt: `Pročelje ${position}`, caption: null, author: 'Ivan Horvat', author_url: null,
  source_url: 'https://commons.wikimedia.org/wiki/File:Brcko.jpg', license: 'cc-by-sa-4.0', ...row
})
const content = buildPublicContent({
  ...fakeRowsWithIntangible(),
  itemImages: [
    image(0, { caption: 'Oko 1910.', author_url: 'https://example.com/ivan' }),
    image(1, { author: 'Župa Kalnik', license: 'permission', source_url: null })
  ]
}, { mediaBase: MEDIA })

registerEndpoint('/api/atlas/heritage/kalnik/crkva-sv-brcka', () => ({ item: heritageItemDetail(content, content.itemById.get(brcko.value.id)!) }))
registerEndpoint('/api/atlas/photos', () => photoCredits(content))

describe('heritage photos', () => {
  it('shows the main photo large with its full credit and the others with theirs', async () => {
    const page = await mountSuspended(HeritageItem, {
      route: { path: '/potkalnicko-prigorje/bastina/kalnik/crkva-sv-brcka', params: { naselje: 'kalnik', slug: 'crkva-sv-brcka' } }
    })
    await vi.waitFor(() => expect(page.find('[data-testid="heritage-photos"]').exists()).toBe(true))
    const images = page.findAll('[data-testid="heritage-photos"] img')
    expect(images.map(img => [img.attributes('alt'), img.attributes('src')])).toEqual([
      ['Pročelje 0', `${MEDIA}/storage/v1/object/public/heritage-media/${file(1)}.webp`],
      ['Pročelje 1', `${MEDIA}/storage/v1/object/public/heritage-media/${file(2)}-thumb.webp`]
    ])
    const credits = page.findAll('[data-testid="pz-photo-credit"]')
    expect(credits.map(credit => credit.text().replace(/\s+/g, ' '))).toEqual([
      'Oko 1910. · Foto: Ivan Horvat, CC BY-SA 4.0 · izvor',
      'Foto: Župa Kalnik, Uz dopuštenje autora'
    ])
    const links = credits[0]!.findAll('a')
    expect(links.map(link => [link.text(), link.attributes('href'), link.attributes('rel')])).toEqual([
      ['Ivan Horvat', 'https://example.com/ivan', 'noopener'],
      ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/', 'license noopener'],
      ['izvor', 'https://commons.wikimedia.org/wiki/File:Brcko.jpg', 'noopener']
    ])
    expect(credits[1]!.findAll('a')).toEqual([])
  })

  it('puts the one-line credit under a card photo', async () => {
    const card = await mountSuspended(PzHeritageCard, {
      props: { title: 'Crkva sv. Brcka', to: '/potkalnicko-prigorje/bastina/kalnik/crkva-sv-brcka', image: `${MEDIA}/thumb.webp`, imageCredit: 'Foto: Ivan Horvat, CC BY-SA 4.0' }
    })
    expect(card.find('img').attributes('src')).toBe(`${MEDIA}/thumb.webp`)
    expect(card.find('[data-testid="pz-heritage-card-credit"]').text()).toBe('Foto: Ivan Horvat, CC BY-SA 4.0')
    const plain = await mountSuspended(PzHeritageCard, { props: { title: 'Kapela', to: '/x' } })
    expect(plain.find('img').exists()).toBe(false)
    expect(plain.find('[data-testid="pz-heritage-card-credit"]').exists()).toBe(false)
  })

  it('lists every photo with its item and credit on the credits page', async () => {
    const page = await mountSuspended(PhotoCredits, { route: '/potkalnicko-prigorje/o-projektu/fotografije' })
    await vi.waitFor(() => expect(page.find('[data-testid="photo-credits"]').exists()).toBe(true))
    const rows = page.findAll('[data-testid="photo-credits"] li')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.find('a').attributes('href')).toBe('/potkalnicko-prigorje/bastina/kalnik/crkva-sv-brcka')
    expect(rows.map(row => row.find('[data-testid="pz-photo-credit"]').text().replace(/\s+/g, ' '))).toEqual([
      'Oko 1910. · Foto: Ivan Horvat, CC BY-SA 4.0 · izvor',
      'Foto: Župa Kalnik, Uz dopuštenje autora'
    ])
  })
})
