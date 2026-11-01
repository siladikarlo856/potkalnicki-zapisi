import { pzRoutes } from './appRoutes'

export const pzNavSections = {
  games: true,
  speech: false,
  contribute: true,
  about: true
} as const

export function pzHeaderNavItems() {
  const items: { label: string, to: string }[] = []
  if (pzNavSections.games) items.push({ label: 'Igre', to: `${pzRoutes.home}/igre` })
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
