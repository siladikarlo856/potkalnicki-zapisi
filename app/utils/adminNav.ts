import type { NavigationMenuItem } from '@nuxt/ui'

/**
 * The admin sidebar, in the order of the content model. Later resources (places, heritage items,
 * categories, challenge templates, history) add their entry here when their page exists.
 */
export const ADMIN_NAV: NavigationMenuItem[] = [
  { label: 'Pregled', icon: 'i-lucide-layout-dashboard', to: '/admin', exact: true },
  { label: 'Prilozi', icon: 'i-lucide-inbox', to: '/admin/prilozi' },
  { label: 'Riječi', icon: 'i-lucide-book-open', to: '/admin/rijeci' },
  { label: 'Baština: ispravci', icon: 'i-lucide-landmark', to: '/admin/bastina' },
  { label: 'Izvori', icon: 'i-lucide-library', to: '/admin/izvori' }
]
