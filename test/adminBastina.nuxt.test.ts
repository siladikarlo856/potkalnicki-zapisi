import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import AdminBastina from '../app/pages/admin/bastina.vue'

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

describe('admin bastina', () => {
  it('shows the correction target in the table', async () => {
    const page = await mountSuspended(AdminBastina)
    await vi.waitFor(() => expect(page.text()).toContain('Crkva sv. Brcka'))
    expect(page.text()).toContain('Kalnik')
    expect(page.find('[data-testid="admin-bastina-table"]').exists()).toBe(true)
  })
})
