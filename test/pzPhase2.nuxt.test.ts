import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Doprinesi from '../app/pages/potkalnicko-prigorje/doprinesi/index.vue'
import Igre from '../app/pages/potkalnicko-prigorje/igre/index.vue'
import About from '../app/pages/potkalnicko-prigorje/o-projektu/index.vue'

describe('Potkalnički zapisi phase 2 routes', () => {
  it('renders the games hub with the play catalogue and friend challenge', async () => {
    const page = await mountSuspended(Igre, { route: '/potkalnicko-prigorje/igre' })
    expect(page.find('[data-testid="friend-challenge-card"]').exists()).toBe(true)
    expect(page.find('[data-testid="play-catalog"]').exists()).toBe(true)
  })

  it('shows the contribution form when a type is selected', async () => {
    const page = await mountSuspended(Doprinesi, { route: '/potkalnicko-prigorje/doprinesi?vrsta=rijec' })
    expect(page.find('[data-testid="contribute-form"]').exists()).toBe(true)
    expect(page.find('form').exists()).toBe(true)
  })

  it('renders O projektu sections', async () => {
    const page = await mountSuspended(About, { route: '/potkalnicko-prigorje/o-projektu' })
    expect(page.text()).toContain('Karlo Siladi')
    expect(page.find('#izvori').exists()).toBe(true)
  })
})
