import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LearnCard from '../app/components/learn/Card.vue'
import { buildCardPool } from '../server/utils/cardPool'
import { buildPublicContent } from '../server/utils/publicContent'
import { gamePoolRows, gamePoolWords } from './fixtures/gamePool'

describe('LearnCard person kind', () => {
  it('shows the clue on the front and profile details on the back', async () => {
    const pool = buildCardPool(buildPublicContent(gamePoolRows(), { loadedAt: 0 }), gamePoolWords())
    const card = pool.cards.find(c => c.kind === 'person')!
    const page = await mountSuspended(LearnCard, {
      props: { card, pool, flipped: false }
    })
    expect(page.text()).toContain(card.clue)
    await page.setProps({ flipped: true })
    expect(page.text()).toContain(card.name)
    expect(page.text()).toContain(card.role)
    expect(page.find('a[href*="/osobe/"]').exists()).toBe(true)
  })
})
