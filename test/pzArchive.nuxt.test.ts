import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import Home from '../app/pages/index.vue'
import Settlement from '../app/pages/naselja/[naselje].vue'
import HeritageList from '../app/pages/bastina/index.vue'
import HeritageItem from '../app/pages/bastina/[naselje]/[slug].vue'
import SpeechWord from '../app/pages/govor/[slug].vue'
import Contribute from '../app/pages/doprinesi/index.vue'
import type { AtlasHeritageItemResponse, AtlasSettlementResponse } from '../shared/types/publicAtlas'
import type { WordPageResponse } from '../shared/types/publicSpeech'
import { registerAtlasApiEndpoints } from './helpers/registerAtlasApi'

registerAtlasApiEndpoints()
registerEndpoint('/api/learn/pool', () => ({
  version: 1, generatedAt: '', cards: [], municipalities: [], settlements: [], topics: [{ id: 'rijeci', label: 'Riječi', status: 'live', count: 0 }]
}))
registerEndpoint('/api/heritage/daily', () => {
  throw createError({ statusCode: 404, statusMessage: 'not-started' })
})

const KALNIK_ITEM = '/bastina/kalnik/crkva-sv-brcka'

// A village with no heritage item yet: the page leads with what is known and one invitation.
const thinSettlement: AtlasSettlementResponse = {
  settlement: {
    id: 's-sopron', slug: 'sopron', name: 'Šopron', code: null, path: '/naselja/sopron',
    centroid: null, credits: [], updatedAt: '2026-11-02T10:00:00.000Z'
  },
  municipality: { id: 'm-kalnik', slug: 'opcina-kalnik', name: 'Kalnik', label: 'Općina Kalnik', kind: 'municipality', path: '/istrazi/opcina-kalnik' },
  items: [],
  persons: []
}
registerEndpoint('/api/atlas/settlements/sopron', () => thinSettlement)

async function heritageItem(overrides: Record<string, unknown>) {
  const real = await $fetch<AtlasHeritageItemResponse>('/api/atlas/heritage/kalnik/crkva-sv-brcka')
  return { item: { ...real.item, ...overrides } }
}
registerEndpoint('/api/atlas/heritage/kalnik/zasticena', async () => heritageItem({ slug: 'zasticena', heritageStatus: 'protected', registryNumber: 'Z-1234' }))

const wordPage: WordPageResponse = {
  word: {
    id: 'w-jejce', slug: 'jejce', headword: 'jejce', meaning: { hr: 'jaje' }, partOfSpeech: 'imenica', status: 'verified',
    examples: [{ text: 'Donesi mi dva jejca.', areaId: 'a-spo' }],
    variants: [
      { id: 'v-base', form: 'jejce', status: 'verified', usages: [{ areaId: 'a-spo', confidence: 'confirmed' }] },
      { id: 'v-jajce', form: 'jajce', status: 'verified', usages: [{ areaId: 'a-kal', confidence: 'reported' }, { areaId: 'a-ka2', confidence: 'reported' }] },
      { id: 'v-jaje', form: 'jaje', status: 'verified', usages: [{ areaId: 'a-kri', confidence: 'reported' }] }
    ],
    sources: [{ id: 's1', kind: 'publication', credit: 'Kajkavski rječnik' }]
  },
  areas: [
    { id: 'a-spo', name: 'Sveti Petar Orehovec', kind: 'settlement', parentId: null },
    { id: 'a-kal', name: 'Kamešnica', kind: 'settlement', parentId: null },
    { id: 'a-ka2', name: 'Kalnik', kind: 'settlement', parentId: null },
    { id: 'a-kri', name: 'Križevci', kind: 'settlement', parentId: null }
  ],
  related: []
}
registerEndpoint('/api/heritage/words/jejce', () => wordPage)

function mount(component: Parameters<typeof mountSuspended>[0], path: string, params: Record<string, string> = {}) {
  return mountSuspended(component, { route: { path, params }, attachTo: document.body })
}

describe('Home', () => {
  it('has the ridge hero, the wheat Riječ dana slot and exactly one inverted slab', async () => {
    const page = await mountSuspended(Home, { route: '' })
    expect(page.find('[data-testid="home-hero"] [data-testid="pz-ridge"]').exists()).toBe(true)
    expect(page.find('h1').classes()).toContain('pz-display')
    expect(page.find('h1').classes()).toContain('lg:pz-display-lg')
    expect(page.findAll('.bg-inverted').length).toBe(1)
    expect(page.find('[data-testid="friend-challenge"]').classes()).toContain('bg-inverted')
    expect(page.find('[data-testid="doprinos"]').classes()).not.toContain('bg-inverted')
    expect(page.find('[data-testid="obuhvat"] h2').text()).toBe('Pet općina')
    expect(page.findAll('[data-testid="municipality-list"] li').length).toBe(5)
  })
})

describe('Settlement', () => {
  it('rich: leads with Riječi iz ovog sela as the primary action', async () => {
    const page = await mount(Settlement, '/naselja/kalnik', { naselje: 'kalnik' })
    await vi.waitFor(() => expect(page.find('[data-testid="settlement-heritage-list"]').exists()).toBe(true))
    expect(page.find('[data-testid="settlement-page"]').attributes('data-state')).toBe('rich')
    expect(page.find('[data-testid="pz-empty-state"]').exists()).toBe(false)
    expect(page.findAll('[data-testid="pz-heritage-card"]').length).toBeGreaterThan(0)
    expect(page.find('[data-testid="settlement-primary-action"]').text()).toBe('Riječi iz ovog sela')
    expect(page.find('[data-testid="settlement-primary-action-mobile"]').text()).toBe('Riječi iz ovog sela')
    page.unmount()
  })

  it('thin: shows the empty state with an invitation and Dodaj zapis as the primary action, never a zero', async () => {
    const page = await mount(Settlement, '/naselja/sopron', { naselje: 'sopron' })
    await vi.waitFor(() => expect(page.find('[data-testid="pz-empty-state"]').exists()).toBe(true))
    expect(page.find('[data-testid="settlement-page"]').attributes('data-state')).toBe('thin')
    expect(page.text()).toContain('Za naselje Šopron još skupljamo zapise.')
    expect(page.find('[data-testid="settlement-heritage-list"]').exists()).toBe(false)
    expect(page.find('[data-testid="pz-empty-actions"]').findAll('a').length).toBe(3)
    expect(page.find('[data-testid="settlement-primary-action-mobile"]').text()).toBe('Dodaj zapis')
    expect(page.find('[data-testid="settlement-primary-action-mobile"]').attributes('href')).toContain('/doprinesi')
    expect(page.text()).not.toContain('0 zapisa')
    page.unmount()
  })
})

describe('Heritage list', () => {
  it('lists HeritageCard items with a count line and category chips that are toggle buttons', async () => {
    const page = await mountSuspended(HeritageList, { route: '/bastina' })
    await vi.waitFor(() => expect(page.findAll('[data-testid="pz-heritage-card"]').length).toBeGreaterThan(1))
    expect(page.find('[data-testid="heritage-count"]').text()).toMatch(/^\d+ zapis/)
    const chips = page.findAll('[data-testid="heritage-filter-category"] button')
    expect(chips.length).toBeGreaterThan(1)
    expect(chips[0]!.attributes('aria-pressed')).toBe('true')
    expect(chips[1]!.attributes('aria-pressed')).toBe('false')
  })
})

describe('Heritage item', () => {
  it('puts the verification badge in the fact panel trust slot and no protection tag without a protected status', async () => {
    const page = await mount(HeritageItem, KALNIK_ITEM, { naselje: 'kalnik', slug: 'crkva-sv-brcka' })
    await vi.waitFor(() => expect(page.find('[data-testid="pz-fact-panel"]').exists()).toBe(true))
    const trust = page.get('[data-testid="pz-fact-panel-trust"]')
    expect(trust.find('[data-testid="verification-badge-unverified"]').exists()).toBe(true)
    expect(trust.text()).toContain('U provjeri')
    expect(page.find('[data-testid^="protection-tag-"]').exists()).toBe(false)
    expect(page.find('h1').classes()).toContain('pz-h1')
    expect(page.find('[data-testid="heritage-research-note"]').text()).toContain('Što još provjeravamo')
    page.unmount()
  })

  it('shows the protection tag only when the record itself says it is protected', async () => {
    const page = await mount(HeritageItem, '/bastina/kalnik/zasticena', { naselje: 'kalnik', slug: 'zasticena' })
    await vi.waitFor(() => expect(page.find('[data-testid="pz-fact-panel-trust"]').exists()).toBe(true))
    const trust = page.get('[data-testid="pz-fact-panel-trust"]')
    expect(trust.get('[data-testid="protection-tag-protected"]').text()).toBe('Zaštićeno kulturno dobro Z-1234')
    page.unmount()
  })

  it('opens Predloži ispravak and Dodaj izvor as sheets, from the sticky bar and the panel', async () => {
    const page = await mount(HeritageItem, KALNIK_ITEM, { naselje: 'kalnik', slug: 'crkva-sv-brcka' })
    await vi.waitFor(() => expect(page.find('[data-testid="pz-sticky-action-bar"]').exists()).toBe(true))
    const bar = page.get('[data-testid="pz-sticky-action-bar"]')
    expect(bar.findAll('button').map(button => button.text())).toEqual(['Dodaj izvor', 'Predloži ispravak'])

    await bar.get('[data-testid="heritage-suggest-correction-mobile"]').trigger('click')
    await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"] [data-testid="suggest-form"]')).not.toBeNull())
    expect(document.body.querySelector('[role="dialog"]')!.textContent).toContain('Predloži ispravak')
    page.unmount()
  })
})

describe('Word page', () => {
  it('shows the headword, the forms with settlement names (never ids) and Uči ovu riječ as the primary action', async () => {
    const page = await mount(SpeechWord, '/govor/jejce', { slug: 'jejce' })
    await vi.waitFor(() => expect(page.find('[data-testid="speech-word-page"]').exists()).toBe(true))
    expect(page.find('h1').classes()).toContain('pz-headword')
    const forms = page.findAll('[data-testid="pz-variant"]')
    expect(forms.map(form => form.find('span.font-serif').text())).toEqual(['jejce', 'jajce', 'jaje'])
    expect(forms[0]!.text()).toContain('Osnovni oblik')
    expect(forms[0]!.text()).toContain('Sveti Petar Orehovec')
    expect(forms[1]!.text()).toContain('2 sela')
    expect(forms[1]!.text()).toContain('Kamešnica')
    expect(page.find('[data-testid="pz-variant-list"]').text()).not.toContain('a-kal')
    expect(page.find('[data-testid="speech-learn-word-mobile"]').text()).toBe('Uči ovu riječ')
    expect(page.find('[data-testid="speech-learn-word"]').attributes('href')).toContain('kartice=word:w-jejce')
    page.unmount()
  })

  it('opens Kod nas se kaže drugačije in a sheet', async () => {
    const page = await mount(SpeechWord, '/govor/jejce', { slug: 'jejce' })
    await vi.waitFor(() => expect(page.find('[data-testid="speech-different-here-mobile"]').exists()).toBe(true))
    await page.get('[data-testid="speech-different-here-mobile"]').trigger('click')
    await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"]')).not.toBeNull())
    expect(document.body.querySelector('[role="dialog"]')!.textContent).toContain('Kako se to kaže kod nas?')
    page.unmount()
  })
})

describe('Contribute', () => {
  it('offers the types as tiles and marks optional fields "(nije obavezno)"', async () => {
    const picker = await mountSuspended(Contribute, { route: '/doprinesi' })
    expect(picker.findAll('[data-testid="contribute-type-picker"] li').length).toBe(7)
    const form = await mountSuspended(Contribute, { route: '/doprinesi?vrsta=rijec' })
    await vi.waitFor(() => expect(form.find('[data-testid="contribute-form"]').exists()).toBe(true))
    expect(form.find('form').exists()).toBe(true)
    expect(form.text()).toContain('Tvoje ime (nije obavezno)')
    expect(form.text()).toContain('Kontakt (nije obavezno)')
    expect(form.text()).not.toContain('(neobavezno)')
    expect(form.find('[data-testid="contribute-submit-mobile"]').attributes('form')).toBe(form.find('form').attributes('id'))
  })
})
