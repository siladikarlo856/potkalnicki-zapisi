import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import Doprinesi from '../app/pages/doprinesi/index.vue'
import Igre from '../app/pages/igre/index.vue'
import About from '../app/pages/o-projektu/index.vue'

registerEndpoint('/api/learn/pool', () => ({ version: 1, generatedAt: '', cards: [], municipalities: [], settlements: [], topics: [] }))

describe('Potkalnički zapisi phase 2 routes', () => {
  it('renders the games list with the play catalogue', async () => {
    const page = await mountSuspended(Igre, { route: '/igre' })
    await expect.poll(() => page.find('[data-testid="play-catalog"]').exists(), { timeout: 3000 }).toBe(true)
  })

  it('shows the contribution form when a type is selected', async () => {
    const page = await mountSuspended(Doprinesi, { route: '/doprinesi?vrsta=rijec' })
    expect(page.find('[data-testid="contribute-form"]').exists()).toBe(true)
    expect(page.find('form').exists()).toBe(true)
  })

  it('renders O projektu sections', async () => {
    const page = await mountSuspended(About, { route: '/o-projektu' })
    expect(page.text()).toContain('Karlo Siladi')
    expect(page.find('#izvori').exists()).toBe(true)
  })
})
