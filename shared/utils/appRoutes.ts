export const PZ_ROOT = '/potkalnicko-prigorje'

export const pzRoutes = {
  home: PZ_ROOT,
  games: `${PZ_ROOT}/igre`,
  cards: `${PZ_ROOT}/igre/kartice`,
  quiz: `${PZ_ROOT}/igre/kviz`,
  challenge: `${PZ_ROOT}/izazov`,
  contribute: `${PZ_ROOT}/doprinesi`,
  about: `${PZ_ROOT}/o-projektu`,
  privacy: `${PZ_ROOT}/privatnost`
} as const

export const pzTopicSlugs = {
  'words': 'rijeci',
  'churches': 'crkve',
  'history': 'povijest',
  'legends': 'legende',
  'geography': 'zemljopis',
  'famous-people': 'poznati-ljudi',
  'sport': 'sport'
} as const

export type PzTopic = keyof typeof pzTopicSlugs
