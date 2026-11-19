import { pzPath } from './appRoutes'

// The address changes of 10-layout-and-navigation.md, section 1: every old address answers 301 to its
// new, trailing-slash address. Pure, so the server middleware and the tests share one rule.

const LEGACY_PREFIX = 'potkalnicko-prigorje'

/** Detail-page kind segments and collection names that were renamed (singular to plural, or to the plain word). */
const INTANGIBLE_KIND_RENAMES: Record<string, string> = {
  'prica': 'price',
  'obicaj': 'obicaji',
  'usmeni-tekst': 'narodni-tekstovi',
  'kazivac': 'kazivaci',
  'tema': 'teme'
}

/** Retired game topic pages, which now filter the games list. */
const GAME_TOPIC_REDIRECTS: Record<string, string> = {
  'rijeci': '?tema=rijeci',
  'crkve': '?tema=bastina',
  'zemljopis': '?tema=mjesta',
  'poznati-ljudi': '?tema=osobe',
  'legende': '?tema=legende',
  'povijest': '',
  'sport': ''
}

/**
 * The first segments of the public site. Only these get the trailing slash enforced; the API, build assets,
 * the admin editor, the locale root and anything unknown are left alone (an unknown address answers 404).
 */
const PUBLIC_ROOTS = new Set([
  'igre', 'uci', 'izazov', 'doprinesi', 'o-projektu', 'privatnost', 'mjesta', 'bastina', 'osobe', 'govor', 'price-i-obicaji'
])
/** Roots of the old addresses, which also answer 301. */
const LEGACY_ROOTS = new Set(['istrazi', 'naselja'])

export type AddressAnswer
  = | { status: 'ok' }
  /** Answer 301 to this address (path and query). */
    | { status: 'redirect', location: string }
  /** `/naselja/[naselje]`: the municipality is looked up, so the server finishes the redirect. */
    | { status: 'settlement', slug: string, search: string }

function mergeSearch(own: string, original: string) {
  const extra = original.replace(/^\?/, '')
  if (!extra) return own
  return own ? `${own}&${extra}` : `?${extra}`
}

/**
 * Where a request for `pathname` belongs: unchanged, a 301 to the new address, or the settlement lookup.
 * Handles the old `/potkalnicko-prigorje/...` prefix, the renamed sections and the trailing slash.
 */
export function answerAddress(pathname: string, search = ''): AddressAnswer {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] === LEGACY_PREFIX) segments.shift()
  const [root, second, third] = segments
  if ((segments.at(-1) ?? '').includes('.')) return { status: 'ok' }
  if (root && !PUBLIC_ROOTS.has(root) && !LEGACY_ROOTS.has(root)) {
    // Only the bare old prefix, or an unknown address under it, still moves to the root.
    return pathname.split('/').filter(Boolean)[0] === LEGACY_PREFIX ? redirectTo(segments, search, pathname) : { status: 'ok' }
  }

  let target: string[] = segments
  let query = ''
  if (root === 'istrazi') {
    target = ['mjesta', ...segments.slice(1)]
  } else if (root === 'naselja' && second && segments.length === 2) {
    return { status: 'settlement', slug: second, search }
  } else if (root === 'price-i-obicaji' && second && INTANGIBLE_KIND_RENAMES[second]) {
    target = [root, INTANGIBLE_KIND_RENAMES[second], ...segments.slice(2)]
  } else if (root === 'igre' && second === 'kartice' && !third) {
    target = ['uci']
    query = '?teme=rijeci'
  } else if (root === 'igre' && second && !third && second in GAME_TOPIC_REDIRECTS) {
    target = ['igre']
    query = GAME_TOPIC_REDIRECTS[second]!
  }

  return redirectTo(target, search, pathname, query)
}

/** The list's `?kind=` filter uses the same kind segments as the detail pages, so an old shared link follows them. */
function renameKindFilter(target: string[], search: string) {
  if (target.length !== 1 || target[0] !== 'price-i-obicaji') return search
  const params = new URLSearchParams(search)
  const renamed = INTANGIBLE_KIND_RENAMES[params.get('kind') ?? '']
  if (!renamed || params.get('kind') === 'kazivac' || params.get('kind') === 'tema') return search
  params.set('kind', renamed)
  return `?${params}`
}

function redirectTo(target: string[], rawSearch: string, pathname: string, query = ''): AddressAnswer {
  const search = renameKindFilter(target, rawSearch)
  const location = `${pzPath(...target)}${mergeSearch(query, search)}`
  return location === `${pathname}${rawSearch}` ? { status: 'ok' } : { status: 'redirect', location }
}
