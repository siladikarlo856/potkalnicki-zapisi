import type { NavigationMenuItem } from '@nuxt/ui'

/** One entry of the admin navigation. `exact` keeps "Nadzorna ploča" from matching every /admin/... path. */
export interface AdminNavItem {
  label: string
  icon: string
  to: string
  exact?: boolean
  /** Shown only when the session may open Korisnici (Google admin). */
  socialAdminOnly?: boolean
}

export interface AdminNavGroup {
  label: string
  items: AdminNavItem[]
}

/** The path of the inbox, whose pending count is shown on every admin screen. */
export const ADMIN_INBOX_PATH = '/admin/prijedlozi'

/**
 * The admin navigation in the design's four fixed groups (21-admin-screens.md "Shell"). A resource adds its entry
 * here when its page exists; the groups are never reordered per user.
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: 'Rad',
    items: [
      { label: 'Nadzorna ploča', icon: 'i-lucide-layout-dashboard', to: '/admin', exact: true },
      { label: 'Prijedlozi', icon: 'i-lucide-inbox', to: ADMIN_INBOX_PATH },
      { label: 'Korisnici', icon: 'i-lucide-users', to: '/admin/korisnici', socialAdminOnly: true }
    ]
  },
  {
    label: 'Sadržaj',
    items: [
      { label: 'Mjesta', icon: 'i-lucide-map-pin', to: '/admin/mjesta' },
      { label: 'Baština', icon: 'i-lucide-landmark', to: '/admin/bastina' },
      { label: 'Osobe', icon: 'i-lucide-user-round', to: '/admin/osobe' },
      { label: 'Klubovi', icon: 'i-lucide-trophy', to: '/admin/klubovi' },
      { label: 'Riječi', icon: 'i-lucide-book-open', to: '/admin/rijeci' },
      { label: 'Priče', icon: 'i-lucide-scroll-text', to: '/admin/price' },
      { label: 'Običaji', icon: 'i-lucide-hand-heart', to: '/admin/obicaji' },
      { label: 'Usmeni tekstovi', icon: 'i-lucide-message-square-quote', to: '/admin/usmeni-tekstovi' }
    ]
  },
  {
    label: 'Igra i učenje',
    items: [
      { label: 'Riječ dana', icon: 'i-lucide-calendar-days', to: '/admin/rijec-dana' },
      { label: 'Izazovi', icon: 'i-lucide-swords', to: '/admin/izazovi' }
    ]
  },
  {
    label: 'Šifrarnici i građa',
    items: [
      { label: 'Kazivači', icon: 'i-lucide-mic', to: '/admin/kazivaci' },
      { label: 'Teme', icon: 'i-lucide-shapes', to: '/admin/teme' },
      { label: 'Kategorije baštine', icon: 'i-lucide-tags', to: '/admin/kategorije' },
      { label: 'Vrste priča', icon: 'i-lucide-tags', to: '/admin/vrste-prica' },
      { label: 'Vrste običaja', icon: 'i-lucide-tags', to: '/admin/vrste-obicaja' },
      { label: 'Vrste usmenih tekstova', icon: 'i-lucide-tags', to: '/admin/vrste-usmenih-tekstova' },
      { label: 'Prigode', icon: 'i-lucide-calendar-heart', to: '/admin/prigode' },
      { label: 'Izvori', icon: 'i-lucide-library', to: '/admin/izvori' },
      { label: 'Povijest', icon: 'i-lucide-history', to: '/admin/povijest' }
    ]
  }
]

/** Every entry, in group order. */
export const ADMIN_NAV: NavigationMenuItem[] = ADMIN_NAV_GROUPS.flatMap(group => group.items)

export function adminNavVisible(item: AdminNavItem, userManagement: boolean) {
  return !item.socialAdminOnly || userManagement
}

/** Whether `path` is inside the nav entry's section (`/admin/rijeci` for the Riječi entry; the dashboard only on `/admin`). */
export function adminNavActive(item: AdminNavItem, path: string) {
  const clean = path.replace(/\/+$/, '') || '/'
  return item.exact ? clean === item.to : clean === item.to || clean.startsWith(`${item.to}/`)
}
