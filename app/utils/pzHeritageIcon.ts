const CHURCH_LIKE = new Set(['church', 'cathedral', 'chapel', 'chapel-shrine', 'monastery'])

/** The Lucide icon of a heritage category tile: a church for sacral buildings, the landmark otherwise. */
export function pzHeritageIcon(categoryKey?: string): string {
  if (!categoryKey) return 'i-lucide-landmark'
  if (CHURCH_LIKE.has(categoryKey)) return 'i-lucide-church'
  if (categoryKey === 'cross' || categoryKey === 'wayside-shrine') return 'i-lucide-cross'
  if (categoryKey === 'archaeological-site') return 'i-lucide-pickaxe'
  return 'i-lucide-landmark'
}
