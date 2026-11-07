import { pzRoutes } from './appRoutes'

export const pzNavSections = {
  games: true,
  explore: true,
  heritage: true,
  speech: true,
  contribute: true,
  about: true
} as const

export function pzHeaderNavItems() {
  const items: { label: string, to: string }[] = []
  if (pzNavSections.games) items.push({ label: 'Igre', to: `${pzRoutes.home}/igre` })
  if (pzNavSections.explore) items.push({ label: 'Istraži', to: `${pzRoutes.home}/istrazi` })
  if (pzNavSections.heritage) items.push({ label: 'Baština', to: `${pzRoutes.home}/bastina` })
  if (pzNavSections.speech) items.push({ label: 'Naš govor', to: `${pzRoutes.home}/govor` })
  if (pzNavSections.contribute) items.push({ label: 'Doprinesi', to: `${pzRoutes.home}/doprinesi` })
  if (pzNavSections.about) items.push({ label: 'O projektu', to: `${pzRoutes.home}/o-projektu` })
  return items
}

export function pzFooterNavItems(privacyEmail: string) {
  return [
    { label: 'O projektu', to: `${pzRoutes.home}/o-projektu` },
    { label: 'Privatnost', to: pzRoutes.privacy },
    { label: 'Kontakt', to: `mailto:${privacyEmail}` }
  ] as const
}

export type PzTabKey = 'home' | 'games' | 'explore' | 'contribute'

/** The four mobile tabs, in order. `label` is the Croatian copy; `icon` is a Lucide icon. */
export const pzTabs: readonly { key: PzTabKey, label: string, to: string, icon: string }[] = [
  { key: 'home', label: 'Početna', to: pzRoutes.home, icon: 'i-lucide-house' },
  { key: 'games', label: 'Igre', to: pzRoutes.games, icon: 'i-lucide-gamepad' },
  { key: 'explore', label: 'Istraži', to: pzRoutes.explore, icon: 'i-lucide-compass' },
  { key: 'contribute', label: 'Doprinesi', to: pzRoutes.contribute, icon: 'i-lucide-pen-line' }
]

function normalisePath(path: string) {
  const bare = path.split(/[?#]/)[0]!.replace(/^\/en(?=\/|$)/, '').replace(/\/+$/, '')
  return bare || '/'
}

function under(path: string, root: string) {
  return path === root || path.startsWith(`${root}/`)
}

/**
 * Which tab marks the current page. Istraži covers the archive: places, Baština, Naš govor
 * (and the person and settlement pages that hang off them). `null` for the pages that belong to no
 * tab, such as O projektu, Privatnost and the challenge flow.
 */
export function pzTabForPath(path: string): PzTabKey | null {
  const p = normalisePath(path)
  if (p === pzRoutes.home) return 'home'
  if (under(p, pzRoutes.games) || under(p, pzRoutes.learn)) return 'games'
  if (under(p, pzRoutes.contribute)) return 'contribute'
  if ([pzRoutes.explore, pzRoutes.heritage, `${pzRoutes.home}/govor`, `${pzRoutes.home}/naselja`, pzRoutes.persons].some(root => under(p, root))) return 'explore'
  return null
}

/** The header section (one of the six) the current page belongs to, for the desktop inline nav. */
export function pzSectionForPath(path: string): string | null {
  const p = normalisePath(path)
  const items = pzHeaderNavItems()
  const hit = items.find(item => under(p, item.to))
  if (hit) return hit.to
  const tab = pzTabForPath(p)
  if (tab === 'explore' && !under(p, pzRoutes.heritage) && !under(p, `${pzRoutes.home}/govor`)) return pzRoutes.explore
  return null
}
