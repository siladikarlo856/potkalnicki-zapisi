import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import PlacePicker from '../app/components/heritage/PlacePicker.vue'

registerEndpoint('/api/places', (event: { path?: string }) => {
  const q = new URLSearchParams((event.path ?? '').split('?')[1] ?? '').get('q') ?? ''
  if (q === 'kri') {
    return {
      version: 'hr-geonames-test',
      places: [{ id: 'geonames:3197230', name: 'Križevci', municipality: 'Križevci', county: 'Koprivničko-križevačka županija' }]
    }
  }
  if (q === 'cak') return { version: 'hr-geonames-test', places: [] }
  return { version: 'hr-geonames-test', places: [] }
})

describe('heritage PlacePicker', () => {
  it('loads scoped place results from /api/places', async () => {
    vi.useFakeTimers()
    const wrapper = await mountSuspended(PlacePicker, {
      props: {
        modelValue: null,
        query: ''
      }
    })
    const input = wrapper.find('input')
    await input.setValue('kri')
    await vi.advanceTimersByTimeAsync(300)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Križevci'))
    expect(wrapper.text()).toContain('Koprivničko-križevačka županija')

    await input.setValue('cak')
    await vi.advanceTimersByTimeAsync(300)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Nema pronađenog naselja'))
    vi.useRealTimers()
    wrapper.unmount()
  })
})
