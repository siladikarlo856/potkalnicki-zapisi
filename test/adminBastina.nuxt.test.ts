import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import AdminBastinaCorrections from '../app/pages/admin/bastina-ispravci.vue'

const correction = {
  id: 12,
  text: 'Zapis: Crkva sv. Brcka\n\nPredloženi ispravak:\nPogrešan naziv općine.',
  type: 'correction' as const,
  targetRef: 'kalnik-crkva-sv-brcka',
  place: null,
  placeId: null,
  placeCatalogVersion: null,
  placeContext: null,
  name: 'Mara',
  contact: null,
  locale: 'hr',
  consentPublish: true,
  consentVersion: '2026-11-01',
  status: 'pending' as const,
  createdAt: '2026-11-01 12:00:00',
  reviewedAt: null
}

registerEndpoint('/api/review/submissions', () => [correction])
registerEndpoint('/api/content/target', () => ({
  kind: 'heritage_item' as const,
  item: {
    ref: 'kalnik-crkva-sv-brcka',
    id: 'test-id',
    slug: 'crkva-sv-brcka',
    name: 'Crkva sv. Brcka',
    category: { key: 'church', label: 'Crkva' },
    municipality: { id: 'm', slug: 'opcina-kalnik', label: 'Općina Kalnik' },
    settlement: { id: 's', slug: 'kalnik', name: 'Kalnik' },
    locality: null,
    verification: 'unverified' as const,
    noindex: false,
    path: '/potkalnicko-prigorje/bastina/kalnik/crkva-sv-brcka'
  }
}))

describe('admin bastina', () => {
  it('shows the correction target in the table', async () => {
    const page = await mountSuspended(AdminBastinaCorrections)
    await vi.waitFor(() => expect(page.text()).toContain('Crkva sv. Brcka'))
    expect(page.text()).toContain('Kalnik')
    expect(page.find('[data-testid="admin-bastina-table"]').exists()).toBe(true)
  })
})
