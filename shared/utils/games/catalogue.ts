import { pzRoutes } from '../appRoutes'
import type { CardKind, CardPool } from '../learn/types'

export type GameFormat = 'dnevna' | 'odabir' | 'karta' | 'upisi' | 'spoji' | 'razvrstaj' | 'grupiraj' | 'bez-greske'

export type GameTopic = 'rijeci' | 'mjesta' | 'bastina' | 'osobe' | 'legende' | 'mjesovito'

export interface GameEntry {
  id: string
  title: string
  blurb: string
  topic: GameTopic
  format: GameFormat
  minutes: number
  path: string
  status: 'live' | 'soon'
  challengeable: boolean
  needs?: { kind: CardKind, min: number }
}

/** Old topic URLs; never reuse these slugs for new game paths (WP2 redirects). */
export const GAME_REDIRECT_SLUGS = [
  'rijeci',
  'crkve',
  'zemljopis',
  'poznati-ljudi',
  'legende',
  'povijest',
  'sport'
] as const

export const GAME_CATALOGUE: GameEntry[] = [
  {
    id: 'rijec-dana',
    title: 'Riječ dana',
    blurb: 'Pogodi značenje današnje riječi iz našeg kraja.',
    topic: 'rijeci',
    format: 'dnevna',
    minutes: 2,
    path: `${pzRoutes.games}#rijec-dana`,
    status: 'live',
    challengeable: false
  },
  {
    id: 'znacenje',
    title: 'Kaj to znači?',
    blurb: 'Deset pitanja o značenju riječi — brzi kviz.',
    topic: 'rijeci',
    format: 'odabir',
    minutes: 5,
    path: pzRoutes.quiz,
    status: 'live',
    challengeable: true
  },
  {
    id: 'rijec',
    title: 'Kak se to veli?',
    blurb: 'Pročitaj značenje i pogodi kak se to kod nas veli.',
    topic: 'rijeci',
    format: 'odabir',
    minutes: 5,
    path: pzRoutes.askWord,
    status: 'live',
    challengeable: true
  },
  {
    id: 'kartice',
    title: 'Kartice',
    blurb: 'Okreni karticu i provjeri znaš li riječ.',
    topic: 'rijeci',
    format: 'odabir',
    minutes: 10,
    path: pzRoutes.cards,
    status: 'live',
    challengeable: false
  },
  {
    id: 'tko-je-to',
    title: 'Tko je to?',
    blurb: 'Poveži osobu s mjestom i ulogom.',
    topic: 'osobe',
    format: 'odabir',
    minutes: 5,
    path: pzRoutes.contribute,
    status: 'soon',
    challengeable: false
  },
  {
    id: 'istina-legenda',
    title: 'Istina ili legenda?',
    blurb: 'Razlikuj legendu od provjerene priče.',
    topic: 'legende',
    format: 'odabir',
    minutes: 5,
    path: pzRoutes.contribute,
    status: 'soon',
    challengeable: false
  }
]

function poolMeetsNeeds(pool: CardPool, needs: { kind: CardKind, min: number }): boolean {
  const count = pool.cards.filter(card => card.kind === needs.kind).length
  return count >= needs.min
}

export function gameVisibleInPool(game: GameEntry, pool: CardPool | null, topic?: string): boolean {
  if (game.status !== 'live') return false
  if (topic && topic !== 'sve' && game.topic !== topic) return false
  if (game.needs) {
    if (!pool) return true
    if (!poolMeetsNeeds(pool, game.needs)) return false
  }
  return true
}

export function visibleGames(pool: CardPool | null, topic?: string): GameEntry[] {
  return GAME_CATALOGUE.filter(game => gameVisibleInPool(game, pool, topic))
}

export function soonGames(): GameEntry[] {
  return GAME_CATALOGUE.filter(game => game.status === 'soon')
}

export function liveTopicsInCatalogue(): GameTopic[] {
  const topics = new Set<GameTopic>()
  for (const game of GAME_CATALOGUE) {
    if (game.status === 'live') topics.add(game.topic)
  }
  return [...topics]
}

export function gamePathUsesRedirectSlug(path: string): boolean {
  return GAME_REDIRECT_SLUGS.some(slug => path.includes(`/igre/${slug}`))
}
