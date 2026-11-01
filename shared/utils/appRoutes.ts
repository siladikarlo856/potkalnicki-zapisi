export const PZ_ROOT = '/potkalnicko-prigorje'

export const pzRoutes = {
  home: PZ_ROOT,
  cards: `${PZ_ROOT}/igre/kartice`,
  quiz: `${PZ_ROOT}/igre/kviz`,
  challenge: `${PZ_ROOT}/izazov`,
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
