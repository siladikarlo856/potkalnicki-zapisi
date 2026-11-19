export const PZ_ROOT = ''

/**
 * Every public address ends in a slash (10-layout-and-navigation.md). `pzPath` builds one from its
 * segments, so a link written with it never forgets the slash.
 */
export function pzPath(...segments: (string | number)[]) {
  const parts = segments.flatMap(segment => String(segment).split('/')).filter(Boolean)
  return parts.length ? `/${parts.join('/')}/` : '/'
}

export const pzRoutes = {
  home: '/',
  archive: pzPath('arhiv'),
  search: pzPath('trazi'),
  play: pzPath('igraj'),
  daily: pzPath('rijec-dana'),
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
