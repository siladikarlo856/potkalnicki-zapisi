import type { NavigationMenuItem } from '@nuxt/ui'

/**
 * The admin sidebar, in the order of the content model. Later resources (places, heritage items,
 * categories) add their entry here when their page exists.
 */
export const ADMIN_NAV: NavigationMenuItem[] = [
  { label: 'Pregled', icon: 'i-lucide-layout-dashboard', to: '/admin', exact: true },
  { label: 'Prilozi', icon: 'i-lucide-inbox', to: '/admin/prilozi' },
  { label: 'Riječi', icon: 'i-lucide-book-open', to: '/admin/rijeci' },
  { label: 'Riječ dana', icon: 'i-lucide-calendar-days', to: '/admin/rijec-dana' },
  { label: 'Baština: ispravci', icon: 'i-lucide-landmark', to: '/admin/bastina' },
  { label: 'Mjesta', icon: 'i-lucide-map-pin', to: '/admin/mjesta' },
  { label: 'Izvori', icon: 'i-lucide-library', to: '/admin/izvori' },
  { label: 'Izazovi', icon: 'i-lucide-trophy', to: '/admin/izazovi' },
  { label: 'Povijest', icon: 'i-lucide-history', to: '/admin/povijest' }
]
