export const PZ_ROOT = '/potkalnicko-prigorje'

export const pzRoutes = {
  home: PZ_ROOT,
  games: `${PZ_ROOT}/igre`,
  cards: `${PZ_ROOT}/igre/kartice`,
  learn: `${PZ_ROOT}/uci`,
  quiz: `${PZ_ROOT}/igre/kviz`,
  askWord: `${PZ_ROOT}/igre/kak-se-veli`,
  group: `${PZ_ROOT}/igre/grupiraj`,
  bezGreske: `${PZ_ROOT}/igre/bez-greske`,
  challenge: `${PZ_ROOT}/izazov`,
  contribute: `${PZ_ROOT}/doprinesi`,
  about: `${PZ_ROOT}/o-projektu`,
  privacy: `${PZ_ROOT}/privatnost`,
  explore: `${PZ_ROOT}/istrazi`,
  heritage: `${PZ_ROOT}/bastina`,
  persons: `${PZ_ROOT}/osobe`
} as const
