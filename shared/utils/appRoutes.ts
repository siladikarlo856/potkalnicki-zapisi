export const PZ_ROOT = '/potkalnicko-prigorje'

export const pzRoutes = {
  home: PZ_ROOT,
  games: `${PZ_ROOT}/igre`,
  cards: `${PZ_ROOT}/igre/kartice`,
  learn: `${PZ_ROOT}/uci`,
  quiz: `${PZ_ROOT}/igre/kviz`,
  askWord: `${PZ_ROOT}/igre/kak-se-veli`,
  opcine: `${PZ_ROOT}/igre/opcine`,
  selaOpcine: `${PZ_ROOT}/igre/sela-i-opcine`,
  nabroji: `${PZ_ROOT}/igre/nabroji`,
  group: `${PZ_ROOT}/igre/grupiraj`,
  bezGreske: `${PZ_ROOT}/igre/bez-greske`,
  mapFind: `${PZ_ROOT}/igre/karta`,
  mapWhich: `${PZ_ROOT}/igre/koje-je-selo`,
  mapLearn: `${PZ_ROOT}/igre/uci-kartu`,
  churchWhere: `${PZ_ROOT}/igre/gdje-je-crkva`,
  heritageMatch: `${PZ_ROOT}/igre/spoji`,
  tkoJeTo: `${PZ_ROOT}/igre/tko-je-to`,
  challenge: `${PZ_ROOT}/izazov`,
  contribute: `${PZ_ROOT}/doprinesi`,
  about: `${PZ_ROOT}/o-projektu`,
  privacy: `${PZ_ROOT}/privatnost`,
  explore: `${PZ_ROOT}/istrazi`,
  heritage: `${PZ_ROOT}/bastina`,
  persons: `${PZ_ROOT}/osobe`,
  intangible: `${PZ_ROOT}/price-i-obicaji`
} as const
