import type { NavigationMenuItem } from '@nuxt/ui'

/**
 * The admin sidebar, in the order of the content model. A resource adds its entry here when its page exists.
 */
export const ADMIN_NAV: NavigationMenuItem[] = [
  { label: 'Pregled', icon: 'i-lucide-layout-dashboard', to: '/admin', exact: true },
  { label: 'Prijedlozi', icon: 'i-lucide-inbox', to: '/admin/prijedlozi' },
  { label: 'Riječi', icon: 'i-lucide-book-open', to: '/admin/rijeci' },
  { label: 'Riječ dana', icon: 'i-lucide-calendar-days', to: '/admin/rijec-dana' },
  { label: 'Baština', icon: 'i-lucide-landmark', to: '/admin/bastina' },
  { label: 'Osobe', icon: 'i-lucide-user-round', to: '/admin/osobe' },
  { label: 'Priče', icon: 'i-lucide-scroll-text', to: '/admin/price' },
  { label: 'Običaji', icon: 'i-lucide-hand-heart', to: '/admin/obicaji' },
  { label: 'Usmeni tekstovi', icon: 'i-lucide-message-square-quote', to: '/admin/usmeni-tekstovi' },
  { label: 'Kazivači', icon: 'i-lucide-mic', to: '/admin/kazivaci' },
  { label: 'Klubovi', icon: 'i-lucide-trophy', to: '/admin/klubovi' },
  { label: 'Kategorije baštine', icon: 'i-lucide-tags', to: '/admin/kategorije' },
  { label: 'Vrste priča', icon: 'i-lucide-tags', to: '/admin/vrste-prica' },
  { label: 'Vrste običaja', icon: 'i-lucide-tags', to: '/admin/vrste-obicaja' },
  { label: 'Vrste usmenih tekstova', icon: 'i-lucide-tags', to: '/admin/vrste-usmenih-tekstova' },
  { label: 'Prigode', icon: 'i-lucide-calendar-heart', to: '/admin/prigode' },
  { label: 'Teme', icon: 'i-lucide-shapes', to: '/admin/teme' },
  { label: 'Mjesta', icon: 'i-lucide-map-pin', to: '/admin/mjesta' },
  { label: 'Izvori', icon: 'i-lucide-library', to: '/admin/izvori' },
  { label: 'Izazovi', icon: 'i-lucide-trophy', to: '/admin/izazovi' },
  { label: 'Povijest', icon: 'i-lucide-history', to: '/admin/povijest' }
]
