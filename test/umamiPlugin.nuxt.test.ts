import { beforeEach, describe, expect, it } from 'vitest'
import { useRouter } from '#imports'

describe('Umami page-view exclusion', () => {
  beforeEach(() => localStorage.clear())

  it.each(['/admin/prijava', '/admin/rijeci', '/en/admin/prijava'])('disables tracking when navigating to %s', async (path) => {
    await useRouter().push(path)
    expect(localStorage.getItem('umami.disabled')).toBe('1')
  })

  it('re-enables tracking on a public atlas page after leaving the admin area', async () => {
    const router = useRouter()
    await router.push('/admin/prijava')
    expect(localStorage.getItem('umami.disabled')).toBe('1')
    await router.push('/potkalnicko-prigorje')
    expect(localStorage.getItem('umami.disabled')).toBeNull()
  })
})
