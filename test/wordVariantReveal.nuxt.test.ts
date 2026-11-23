import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { WordEntry } from '../app/types/heritage'
import HeritageVariantList from '../app/components/heritage/VariantList.vue'
import LearnCard from '../app/components/learn/Card.vue'
import type { CardPool, PoolWord } from '../shared/utils/learn/types'

function entry(): WordEntry {
  return {
    id: 'skrlec',
    headword: 'škrlec',
    meaning: { hr: 'šeširić' },
    status: 'verified',
    sources: [],
    variants: [
      { id: 'base', form: 'škrlec', status: 'verified', usages: [{ areaId: 'other', confidence: 'confirmed' }] },
      { id: 'local', form: 'škrleč', status: 'verified', usages: [{ areaId: 'fodrovec', confidence: 'confirmed' }] },
      { id: 'extra', form: 'škrlecak', status: 'verified', usages: [{ areaId: 'other-2', confidence: 'confirmed' }] }
    ]
  }
}

describe('word reveal variant ordering', () => {
  it('shows Glavno mjesto on the matching variant', async () => {
    const wrapper = await mountSuspended(HeritageVariantList, {
      props: { entry: entry(), placeAreaId: 'fodrovec', placeIsMain: true }
    })
    expect(wrapper.get('[data-testid="variant-preferred"]').text()).toContain('škrleč')
    expect(wrapper.get('[data-testid="variant-preferred"]').text()).toContain('Glavno mjesto')
    expect(wrapper.find('[data-testid="variant-no-match"]').exists()).toBe(false)
  })

  it('uses neutral copy when the place is not the saved main place', async () => {
    const wrapper = await mountSuspended(HeritageVariantList, {
      props: { entry: entry(), placeAreaId: 'fodrovec' }
    })
    const preferred = wrapper.get('[data-testid="variant-preferred"]').text()
    expect(preferred).toContain('Odabrano mjesto')
    expect(preferred).not.toContain('Glavno mjesto')
  })

  it('keeps the base form label on the base variant after reordering', async () => {
    const wrapper = await mountSuspended(HeritageVariantList, {
      props: { entry: entry(), placeAreaId: 'fodrovec' }
    })
    const rows = wrapper.findAll('li')
    expect(rows[0]!.text()).not.toContain('osnovni oblik')
    expect(rows[1]!.text()).toContain('osnovni oblik')
    expect(wrapper.text().match(/osnovni oblik/g)).toHaveLength(1)
  })

  it('does not hint a preferred place without a choice', async () => {
    const wrapper = await mountSuspended(HeritageVariantList, { props: { entry: entry() } })
    expect(wrapper.text()).toContain('osnovni oblik')
    expect(wrapper.text()).not.toContain('Glavno mjesto')
    expect(wrapper.find('[data-testid="variant-no-match"]').exists()).toBe(false)
  })

  it('notes when no variant matches the chosen place', async () => {
    const wrapper = await mountSuspended(HeritageVariantList, {
      props: { entry: entry(), placeAreaId: 'apatovec' }
    })
    expect(wrapper.get('[data-testid="variant-no-match"]').text()).toContain('Nema zabilježene inačice')
    expect(wrapper.text()).toContain('osnovni oblik')
    expect(wrapper.find('[data-testid="variant-preferred"]').exists()).toBe(false)
  })

  it('passes the session place through the learn card', async () => {
    const pool: CardPool = {
      version: 1,
      generatedAt: '',
      municipalities: [{ id: 'mun', slug: 'mun', name: 'M', label: 'M', dative: 'M', lat: 0, lng: 0 }],
      settlements: [{ id: 'fodrovec', slug: 'gornji-fodrovec', name: 'Gornji Fodrovec', municipalityId: 'mun' }],
      topics: [],
      cards: []
    }
    const word: PoolWord = {
      kind: 'word',
      key: 'word:skrlec',
      id: 'skrlec',
      topics: ['rijeci'],
      headword: 'škrlec',
      meaning: 'šeširić',
      variants: ['škrlec', 'škrleč', 'škrlecak'],
      variantDetails: [
        { id: 'base', form: 'škrlec', usages: [{ areaId: 'other' }] },
        { id: 'local', form: 'škrleč', usages: [{ areaId: 'fodrovec' }] },
        { id: 'extra', form: 'škrlecak', usages: [{ areaId: 'other-2' }] }
      ],
      status: 'verified',
      transparency: 0.5,
      difficulty: 2
    }
    const wrapper = await mountSuspended(LearnCard, {
      props: { card: word, pool, placeSlug: 'gornji-fodrovec', placeIsMain: true, flipped: true }
    })
    const preferred = wrapper.find('[data-testid="variant-preferred"]')
    expect(preferred.exists()).toBe(true)
    expect(preferred.text()).toContain('Glavno mjesto')
  })
})
