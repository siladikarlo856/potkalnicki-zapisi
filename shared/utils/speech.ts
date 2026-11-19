import { pzPath } from './appRoutes'

/** Canonical path for a public word archive page (unlocalized; pass through localePath). */
export function wordArchivePagePath(slug: string) {
  return pzPath('govor', slug)
}
