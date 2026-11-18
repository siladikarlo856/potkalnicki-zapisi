export const PZ_ROOT = ''

/**
 * Every public address ends in a slash (10-layout-and-navigation.md). `pzPath` builds one from its
 * segments and `withTrailingSlash` fixes a path that may carry a query or a hash; a link is written
 * with either, so the slash is never forgotten.
 */
export function pzPath(...segments: (string | number)[]) {
  const parts = segments.flatMap(segment => String(segment).split('/')).filter(Boolean)
  return parts.length ? `/${parts.join('/')}/` : '/'
}

export function withTrailingSlash(path: string) {
  const at = path.search(/[?#]/)
  const pathname = at === -1 ? path : path.slice(0, at)
  const rest = at === -1 ? '' : path.slice(at)
  return `${pathname.endsWith('/') ? pathname : `${pathname}/`}${rest}`
}

export const pzRoutes = {
  home: '/',
  games: pzPath('igre'),
  cards: pzPath('igre', 'kartice'),
  learn: pzPath('uci'),
  learnSession: pzPath('uci', 'sesija'),
  quiz: pzPath('igre', 'kviz'),
  askWord: pzPath('igre', 'kak-se-veli'),
  opcine: pzPath('igre', 'opcine'),
  selaOpcine: pzPath('igre', 'sela-i-opcine'),
  nabroji: pzPath('igre', 'nabroji'),
  group: pzPath('igre', 'grupiraj'),
  bezGreske: pzPath('igre', 'bez-greske'),
  mapFind: pzPath('igre', 'karta'),
  mapWhich: pzPath('igre', 'koje-je-selo'),
  mapLearn: pzPath('igre', 'uci-kartu'),
  churchWhere: pzPath('igre', 'gdje-je-crkva'),
  heritageMatch: pzPath('igre', 'spoji'),
  tkoJeTo: pzPath('igre', 'tko-je-to'),
  challenge: pzPath('izazov'),
  challengeNew: pzPath('izazov', 'novi'),
  contribute: pzPath('doprinesi'),
  about: pzPath('o-projektu'),
  aboutPhotos: pzPath('o-projektu', 'fotografije'),
  privacy: pzPath('privatnost'),
  places: pzPath('mjesta'),
  heritage: pzPath('bastina'),
  persons: pzPath('osobe'),
  speech: pzPath('govor'),
  intangible: pzPath('price-i-obicaji')
} as const

/** A municipality or town page: /mjesta/[opcina]/. */
export const municipalityPagePath = (municipalitySlug: string) => pzPath(pzRoutes.places, municipalitySlug)

/** A settlement page: /mjesta/[opcina]/[naselje]/ (it hangs off its municipality). */
export const settlementPagePath = (municipalitySlug: string, settlementSlug: string) => pzPath(pzRoutes.places, municipalitySlug, settlementSlug)
