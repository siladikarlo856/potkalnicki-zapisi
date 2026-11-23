import { pzRoutes } from '../appRoutes'
import type { CardKey, CardKind } from '../learn/types'
import { encodeCardKey, type CardKeyParts } from './cardKey'
import type { GameId } from './types'
import type { QuestionGenerator } from './questionGenerators/generator'
import { klubLigaQuestions, klubMjestoQuestions, klubOdakleQuestions } from './questionGenerators/clubs'
import { crkvaQuestions } from './questionGenerators/heritage'
import { osobaQuestions } from './questionGenerators/persons'
import { kartaKojeQuestions, kartaTockeQuestions, opcinaQuestions } from './questionGenerators/places'
import { rijecQuestions, znacenjeQuestions } from './questionGenerators/words'

export type GameFormat = 'dnevna' | 'odabir' | 'karta' | 'upisi' | 'spoji' | 'razvrstaj' | 'grupiraj' | 'bez-greske'

export type GameTopic = 'rijeci' | 'mjesta' | 'bastina' | 'osobe' | 'legende' | 'mjesovito'

/** How a game appears in the games catalogue (igre). Games without it are played only in a Challenge. */
export interface GameCatalogueMeta {
  blurb: string
  topic: GameTopic
  format: GameFormat
  minutes: number
  path: string
  status: 'live' | 'soon'
  /** The fewest cards of one kind the card pool needs before the tile is shown. */
  needs?: { kind: CardKind, min: number }
}

/**
 * Everything that identifies a game, in one place. The id is the only key a game has:
 * questions, best scores and the catalogue tile all use it.
 */
export interface GameDefinition {
  id: GameId
  label: { hr: string, en: string }
  /** Whether a Challenge can be made from this game. */
  challengeable: boolean
  /** The card a question of this game is about: its kind and, when the game asks something else about that card, the key's suffix. */
  questionCard?: Omit<CardKeyParts, 'id'>
  /** How the game makes its multiple-choice questions. Every challengeable game has one. */
  questions?: QuestionGenerator
  catalogue?: GameCatalogueMeta
}

// Insertion order is catalogue order.
const DEFINITIONS = {
  'rijec-dana': {
    label: { hr: 'Riječ dana', en: 'Word of the day' },
    challengeable: false,
    catalogue: { blurb: 'Pogodi današnju riječ iz tri traga', topic: 'rijeci', format: 'dnevna', minutes: 2, path: pzRoutes.daily, status: 'live' }
  },
  'znacenje': {
    label: { hr: 'Kaj to znači?', en: 'What does it mean?' },
    challengeable: true,
    questionCard: { kind: 'word' },
    questions: znacenjeQuestions,
    catalogue: { blurb: 'Deset pitanja o značenju riječi — brzi kviz.', topic: 'rijeci', format: 'odabir', minutes: 5, path: pzRoutes.quiz, status: 'live' }
  },
  'rijec': {
    label: { hr: 'Kak se to veli?', en: 'Local word' },
    challengeable: true,
    questionCard: { kind: 'word' },
    questions: rijecQuestions,
    catalogue: { blurb: 'Pročitaj značenje i pogodi kak se to kod nas veli.', topic: 'rijeci', format: 'odabir', minutes: 5, path: pzRoutes.askWord, status: 'live' }
  },
  'karta': {
    label: { hr: 'Pronađi selo', en: 'Find the village' },
    challengeable: false,
    catalogue: { blurb: 'Na karti pronađi naselje — točnost ovisi o težini.', topic: 'mjesta', format: 'karta', minutes: 8, path: pzRoutes.mapFind, status: 'live', needs: { kind: 'place', min: 10 } }
  },
  'karta-koje': {
    label: { hr: 'Koje je ovo selo?', en: 'Which village is this?' },
    challengeable: true,
    questionCard: { kind: 'place' },
    questions: kartaKojeQuestions,
    catalogue: { blurb: 'Pogledaj točku na karti i odaberi pravo ime.', topic: 'mjesta', format: 'karta', minutes: 8, path: pzRoutes.mapWhich, status: 'live', needs: { kind: 'place', min: 4 } }
  },
  'uci-kartu': {
    label: { hr: 'Uči kartu', en: 'Learn the map' },
    challengeable: false,
    catalogue: { blurb: 'Istraži naselja na karti i otvori njihove stranice.', topic: 'mjesta', format: 'karta', minutes: 10, path: pzRoutes.mapLearn, status: 'live', needs: { kind: 'place', min: 5 } }
  },
  'kartice': {
    label: { hr: 'Uči riječi', en: 'Learn words' },
    challengeable: false,
    catalogue: { blurb: 'Okreni karticu i provjeri znaš li riječ.', topic: 'rijeci', format: 'odabir', minutes: 10, path: pzRoutes.learn, status: 'live' }
  },
  'opcina': {
    label: { hr: 'Kojoj općini pripada?', en: 'Which municipality?' },
    challengeable: true,
    questionCard: { kind: 'place' },
    questions: opcinaQuestions,
    catalogue: { blurb: 'Deset pitanja: pogodi općinu ili grad kojem selo pripada.', topic: 'mjesta', format: 'odabir', minutes: 5, path: pzRoutes.opcine, status: 'live', needs: { kind: 'place', min: 10 } }
  },
  'sela-i-opcine': {
    label: { hr: 'Sela i općine', en: 'Villages and municipalities' },
    challengeable: false,
    catalogue: { blurb: 'Razvrstaj sela po općinama — dodirni selo, zatim kutiju.', topic: 'mjesta', format: 'razvrstaj', minutes: 5, path: pzRoutes.selaOpcine, status: 'live', needs: { kind: 'place', min: 8 } }
  },
  'nabroji': {
    label: { hr: 'Nabroji naselja', en: 'Name the settlements' },
    challengeable: false,
    catalogue: { blurb: 'Upiši sva naselja odabrane općine prije nego istekne vrijeme.', topic: 'mjesta', format: 'upisi', minutes: 8, path: pzRoutes.nabroji, status: 'live', needs: { kind: 'place', min: 1 } }
  },
  'grupiraj': {
    label: { hr: 'Grupiraj', en: 'Group them' },
    challengeable: false,
    catalogue: { blurb: 'Pronađi četiri skupine po četiri — riječi ili naselja.', topic: 'mjesovito', format: 'grupiraj', minutes: 8, path: pzRoutes.group, status: 'live' }
  },
  'bez-greske': {
    label: { hr: 'Bez greške', en: 'No mistakes' },
    challengeable: false,
    catalogue: { blurb: 'Koliko pitanja možeš pogoditi zaredom?', topic: 'mjesovito', format: 'bez-greske', minutes: 5, path: pzRoutes.bezGreske, status: 'live', needs: { kind: 'word', min: 3 } }
  },
  'crkva': {
    label: { hr: 'Gdje je ta crkva?', en: 'Where is the church?' },
    challengeable: true,
    questionCard: { kind: 'item' },
    questions: crkvaQuestions,
    catalogue: { blurb: 'Poveži sakralni zapis s naseljem u kojem se nalazi.', topic: 'bastina', format: 'odabir', minutes: 5, path: pzRoutes.churchWhere, status: 'live', needs: { kind: 'item', min: 10 } }
  },
  'spoji': {
    label: { hr: 'Spoji crkvu i selo', en: 'Match church and village' },
    challengeable: false,
    catalogue: { blurb: 'Spoji svaki zapis s naseljem — tri runde po četiri para.', topic: 'bastina', format: 'spoji', minutes: 5, path: pzRoutes.heritageMatch, status: 'live', needs: { kind: 'item', min: 4 } }
  },
  'osoba': {
    label: { hr: 'Tko je to?', en: 'Who is this?' },
    challengeable: true,
    questionCard: { kind: 'person' },
    questions: osobaQuestions,
    catalogue: { blurb: 'Poveži natuknicu s imenom osobe iz našeg kraja.', topic: 'osobe', format: 'odabir', minutes: 5, path: pzRoutes.tkoJeTo, status: 'live', needs: { kind: 'person', min: 4 } }
  },
  'istina-legenda': {
    label: { hr: 'Istina ili legenda?', en: 'Truth or legend?' },
    challengeable: false,
    catalogue: { blurb: 'Razlikuj legendu od provjerene priče.', topic: 'legende', format: 'odabir', minutes: 5, path: pzRoutes.contribute, status: 'soon' }
  },
  // Played only in a Challenge: no catalogue tile.
  'karta-tocke': {
    label: { hr: 'Pronađi selo (4 točke)', en: 'Find the village (4 points)' },
    challengeable: true,
    questionCard: { kind: 'place', suffix: 'tocke' },
    questions: kartaTockeQuestions
  },
  'klub-mjesto': {
    label: { hr: 'Koji klub igra u mjestu?', en: 'Which club plays in the settlement?' },
    challengeable: true,
    questionCard: { kind: 'club', suffix: 'mjesto' },
    questions: klubMjestoQuestions
  },
  'klub-liga': {
    label: { hr: 'U kojoj ligi klub igra u sezoni?', en: 'Which league does the club play in?' },
    challengeable: true,
    questionCard: { kind: 'club', suffix: 'liga' },
    questions: klubLigaQuestions
  },
  'klub-odakle': {
    label: { hr: 'Odakle je klub?', en: 'Where is the club from?' },
    challengeable: true,
    questionCard: { kind: 'club', suffix: 'odakle' },
    questions: klubOdakleQuestions
  }
} satisfies Record<GameId, Omit<GameDefinition, 'id'>>

/** One record per game, in catalogue order. */
export const GAME_DEFINITIONS: readonly GameDefinition[] = Object.entries(DEFINITIONS)
  .map(([id, definition]) => ({ id: id as GameId, ...definition }))

/** The games a Challenge can be made from, in catalogue order. */
export type ChallengeableGameId = {
  [Id in keyof typeof DEFINITIONS]: typeof DEFINITIONS[Id]['challengeable'] extends true ? Id : never
}[keyof typeof DEFINITIONS]

export const CHALLENGEABLE_GAMES: readonly ChallengeableGameId[] = GAME_DEFINITIONS
  .filter(definition => definition.challengeable)
  .map(definition => definition.id as ChallengeableGameId)

const BY_ID = new Map(GAME_DEFINITIONS.map(definition => [definition.id, definition]))

export function gameDefinition(id: GameId): GameDefinition {
  return BY_ID.get(id)!
}

/** The CardKey a question of this game carries for the entity it asks about. */
export function questionCardKey(game: ChallengeableGameId, entityId: string): CardKey {
  return encodeCardKey({ ...gameDefinition(game).questionCard!, id: entityId })
}
