import { pzRoutes } from '../appRoutes'
import { cardMatchesTopicSelection, unitDative } from '../learn/topics'
import type { CardKey, CardPool, PoolClub, PoolItem, PoolPerson, PoolPlace, PoolWord, TopicId } from '../learn/types'
import {
  buildWordHeadwordOptions,
  buildWordMeaningOptions,
  distanceKm,
  municipalityFor,
  optionsValid,
  pickItemSettlementDistractors,
  pickItemTarget,
  pickPersonDistractors,
  pickPersonTarget,
  pickPlaceTarget,
  pickPlaceUnitDistractors,
  pickWordDistractors,
  pickWordTarget,
  slugMap
} from './distractors'
import { questionCardKey } from './definitions'
import type { Rng } from './rng'
import { shuffled } from './rng'
import type { Difficulty, GameId, GameQuestion, GenerateGameId, GenerateQuestionsOptions } from './types'

const CHALLENGE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/

const atlasSettlementPath = (slug: string) => `${pzRoutes.home}/naselja/${slug}`
const atlasPersonPath = (slug: string) => `${pzRoutes.persons}/${slug}`

function questionId(game: GameId, kind: string, entityId: string): string {
  const id = `${game}_${kind}_${entityId}`
  if (id.length > 200 || !CHALLENGE_ID.test(id)) throw new Error('Invalid question id')
  return id
}

function verifiedWords(pool: CardPool, topics: GenerateQuestionsOptions['topics'], wordStatus: GenerateQuestionsOptions['wordStatus'] = 'verified'): PoolWord[] {
  const slugs = slugMap(pool)
  return pool.cards.filter((c): c is PoolWord =>
    c.kind === 'word' && (wordStatus === 'any' || c.status === 'verified') && cardMatchesTopicSelection(c, topics, slugs))
}

function places(pool: CardPool, topics: GenerateQuestionsOptions['topics']): PoolPlace[] {
  const slugs = slugMap(pool)
  return pool.cards.filter((c): c is PoolPlace =>
    c.kind === 'place' && cardMatchesTopicSelection(c, topics, slugs))
}

function churchItems(pool: CardPool, topics: GenerateQuestionsOptions['topics']): PoolItem[] {
  const slugs = slugMap(pool)
  return pool.cards.filter((c): c is PoolItem =>
    c.kind === 'item' && cardMatchesTopicSelection(c, topics, slugs))
}

function settlementName(pool: CardPool, settlementId: string): string {
  return pool.settlements.find(s => s.id === settlementId)?.name ?? settlementId
}

function poolPersons(pool: CardPool, topics: GenerateQuestionsOptions['topics']): PoolPerson[] {
  const slugs = slugMap(pool)
  return pool.cards.filter((c): c is PoolPerson =>
    c.kind === 'person' && cardMatchesTopicSelection(c, topics, slugs))
}

function osobaQuestion(pool: CardPool, target: PoolPerson, difficulty: Difficulty, rng: Rng): GameQuestion | null {
  const distractors = pickPersonDistractors(target, pool, difficulty, rng)
  if (distractors.length < 2) return null
  const options = shuffled([target, ...distractors], rng).map(p => ({ hr: p.name, en: p.name }))
  if (!optionsValid(options)) return null
  const correct = options.findIndex(o => o.hr === target.name)
  return {
    id: questionId('osoba', 'person', target.id),
    gameId: 'osoba',
    card: target.key,
    prompt: {
      hr: `Tko je to? ${target.clue}`,
      en: `Who is this? ${target.clue}`
    },
    options,
    correct,
    explanation: {
      hr: `To je ${target.name} (${target.years}).`,
      en: `This is ${target.name} (${target.years}).`
    },
    archivePath: atlasPersonPath(target.slug)
  }
}

function znacenjeQuestion(pool: CardPool, target: PoolWord, difficulty: Difficulty, rng: Rng, wordStatus?: GenerateQuestionsOptions['wordStatus']): GameQuestion | null {
  const words = verifiedWords(pool, target.topics.length ? target.topics : ['rijeci'], wordStatus)
  const distractors = pickWordDistractors('znacenje', target, words, difficulty, rng)
  if (distractors.length < 2) return null
  const { options, correct, cards } = buildWordMeaningOptions(target, distractors, rng)
  if (!optionsValid(options)) return null
  const meaningEn = target.meaningEn?.trim() || target.meaning
  return {
    id: questionId('znacenje', 'word', target.id),
    gameId: 'znacenje',
    card: target.key,
    prompt: {
      hr: `Što znači riječ „${target.headword}”?`,
      en: `What does “${target.headword}” mean?`
    },
    options,
    correct,
    explanation: {
      hr: `„${target.headword}” znači „${target.meaning.trim()}”.`,
      en: `“${target.headword}” means “${meaningEn}”.`
    },
    optionCards: cards
  }
}

function rijecQuestion(pool: CardPool, target: PoolWord, difficulty: Difficulty, rng: Rng, wordStatus?: GenerateQuestionsOptions['wordStatus']): GameQuestion | null {
  const words = verifiedWords(pool, target.topics.length ? target.topics : ['rijeci'], wordStatus)
  const distractors = pickWordDistractors('rijec', target, words, difficulty, rng)
  if (distractors.length < 2) return null
  const { options, correct, cards } = buildWordHeadwordOptions(target, distractors, rng)
  if (!optionsValid(options)) return null
  const meaningEn = target.meaningEn?.trim() || target.meaning
  return {
    id: questionId('rijec', 'word', target.id),
    gameId: 'rijec',
    card: target.key,
    prompt: {
      hr: `Kak se kod nas veli „${target.meaning.trim()}”?`,
      en: `Which local word means “${meaningEn}”?`
    },
    options,
    correct,
    explanation: {
      hr: `„${target.meaning.trim()}” se kod nas veli „${target.headword}”.`,
      en: `The local word is “${target.headword}”.`
    },
    optionCards: cards
  }
}

function opcinaQuestion(pool: CardPool, place: PoolPlace, difficulty: Difficulty, rng: Rng): GameQuestion | null {
  const unit = municipalityFor(pool, place.municipalityId)
  if (!unit) return null
  const distractors = pickPlaceUnitDistractors(place, pool.municipalities, difficulty, rng)
  if (distractors.length < 1) return null
  const options = shuffled([unit, ...distractors], rng).map(m => ({ hr: m.label, en: m.label }))
  if (!optionsValid(options)) return null
  const correct = options.findIndex(o => o.hr === unit.label)
  const dative = unitDative(unit.slug, unit.label)
  return {
    id: questionId('opcina', 'place', place.id),
    gameId: 'opcina',
    card: place.key,
    prompt: {
      hr: `Kojoj općini ili gradu pripada ${place.name}?`,
      en: `Which municipality or town is ${place.name} in?`
    },
    options,
    correct,
    explanation: {
      hr: `${place.name} pripada ${dative}.`,
      en: `${place.name} is in ${unit.label}.`
    },
    archivePath: atlasSettlementPath(place.slug)
  }
}

function crkvaQuestion(pool: CardPool, item: PoolItem, difficulty: Difficulty, rng: Rng): GameQuestion | null {
  const settlement = settlementName(pool, item.settlementId)
  const unit = municipalityFor(pool, item.municipalityId)
  const names = pickItemSettlementDistractors(item, pool, difficulty, rng)
  if (names.length < 2) return null
  const options = shuffled([settlement, ...names], rng).map(name => ({ hr: name, en: name }))
  if (!optionsValid(options)) return null
  const correct = options.findIndex(o => o.hr === settlement)
  const unitLabel = unit?.label ?? ''
  return {
    id: questionId('crkva', 'item', item.id),
    gameId: 'crkva',
    card: item.key,
    prompt: {
      hr: `Gdje se nalazi ${item.name}?`,
      en: `Where is ${item.name}?`
    },
    options,
    correct,
    explanation: {
      hr: `${item.name} je u naselju ${settlement}${unitLabel ? ` (${unitLabel})` : ''}.`,
      en: `${item.name} is in ${settlement}${unitLabel ? ` (${unitLabel})` : ''}.`
    },
    archivePath: item.path
  }
}

function kartaKojeQuestion(pool: CardPool, place: PoolPlace, difficulty: Difficulty, rng: Rng): GameQuestion | null {
  const settlements = pool.settlements.filter(s => s.id !== place.id)
  let names: string[]
  if (difficulty === 'lako') {
    const far = settlements.filter((s) => {
      const other = pool.cards.find(c => c.kind === 'place' && c.id === s.id) as PoolPlace | undefined
      return other && distanceKm(place.lat, place.lng, other.lat, other.lng) > 8
    })
    names = shuffled(far.length >= 3 ? far : settlements, rng).slice(0, 3).map(s => s.name)
  } else if (difficulty === 'tesko') {
    const ranked = settlements.map((s) => {
      const other = pool.cards.find(c => c.kind === 'place' && c.id === s.id) as PoolPlace | undefined
      return { s, d: other ? distanceKm(place.lat, place.lng, other.lat, other.lng) : Infinity }
    })
    ranked.sort((a, b) => a.d - b.d)
    names = ranked.slice(0, 3).map(r => r.s.name)
  } else {
    names = shuffled(settlements, rng).slice(0, 3).map(s => s.name)
  }
  if (names.length < 2) return null
  const unit = municipalityFor(pool, place.municipalityId)
  const options = shuffled([place.name, ...names], rng).map(name => ({ hr: name, en: name }))
  if (!optionsValid(options)) return null
  return {
    id: questionId('karta-koje', 'place', place.id),
    gameId: 'karta-koje',
    card: place.key,
    prompt: { hr: 'Koje je ovo selo?', en: 'Which village is this?' },
    options,
    correct: options.findIndex(o => o.hr === place.name),
    explanation: {
      hr: `To je ${place.name}${unit ? ` (${unit.label})` : ''}.`,
      en: `This is ${place.name}${unit ? ` (${unit.label})` : ''}.`
    },
    archivePath: atlasSettlementPath(place.slug),
    display: { type: 'map-target', point: { lat: place.lat, lng: place.lng } }
  }
}

function numberedPointOptions(count: number): { hr: string, en: string }[] {
  return Array.from({ length: count }, (_, index) => ({
    hr: `Točka ${index + 1}`,
    en: `Point ${index + 1}`
  }))
}

function kartaTockeQuestion(pool: CardPool, target: PoolPlace, difficulty: Difficulty, rng: Rng): GameQuestion | null {
  const settlements = places(pool, target.topics.length ? target.topics : ['mjesta'])
  let distractors: PoolPlace[]
  if (difficulty === 'lako') {
    const far = settlements.filter((s) => {
      if (s.id === target.id) return false
      return distanceKm(target.lat, target.lng, s.lat, s.lng) > 8
    })
    distractors = shuffled(far.length >= 3 ? far : settlements.filter(s => s.id !== target.id), rng).slice(0, 3)
  } else if (difficulty === 'tesko') {
    const ranked = settlements
      .filter(s => s.id !== target.id)
      .map(s => ({ s, d: distanceKm(target.lat, target.lng, s.lat, s.lng) }))
    ranked.sort((a, b) => a.d - b.d)
    distractors = ranked.slice(0, 3).map(r => r.s)
  } else {
    distractors = shuffled(settlements.filter(s => s.id !== target.id), rng).slice(0, 3)
  }
  if (distractors.length < 3) return null
  const picked = shuffled([target, ...distractors], rng)
  const correct = picked.findIndex(p => p.id === target.id)
  const options = numberedPointOptions(4)
  if (!optionsValid(options)) return null
  const unit = municipalityFor(pool, target.municipalityId)
  return {
    id: questionId('karta-tocke', 'place', target.id),
    gameId: 'karta-tocke',
    card: questionCardKey('karta-tocke', target.id),
    prompt: { hr: `Gdje je ${target.name}?`, en: `Where is ${target.name}?` },
    options,
    correct,
    explanation: {
      hr: `${target.name} je točka ${correct + 1}.${unit ? ` (${unit.label})` : ''}`,
      en: `${target.name} is point ${correct + 1}.${unit ? ` (${unit.label})` : ''}`
    },
    archivePath: atlasSettlementPath(target.slug),
    display: { type: 'map-points', points: picked.map(p => ({ lat: p.lat, lng: p.lng })) }
  }
}

function poolClubs(pool: CardPool, topics: GenerateQuestionsOptions['topics']): PoolClub[] {
  const slugs = slugMap(pool)
  return pool.cards.filter((c): c is PoolClub =>
    c.kind === 'club' && cardMatchesTopicSelection(c, topics, slugs))
}

function pickClubDistractors(target: PoolClub, pool: PoolClub[], count: number, rng: Rng): PoolClub[] {
  const others = pool.filter(c => c.id !== target.id && c.name !== target.name)
  return shuffled(others, rng).slice(0, count)
}

function uniqueSettlementTargets(pool: PoolClub[]): PoolClub[] {
  const bySettlement = new Map<string, PoolClub[]>()
  for (const club of pool) {
    if (!club.seniorSeason || club.sport !== 'nogomet') continue
    bySettlement.set(club.settlementId, [...(bySettlement.get(club.settlementId) ?? []), club])
  }
  return [...bySettlement.values()].filter(list => list.length === 1).map(list => list[0]!)
}

function klubMjestoQuestion(pool: CardPool, target: PoolClub, rng: Rng): GameQuestion | null {
  const distractors = pickClubDistractors(target, poolClubs(pool, target.topics.length ? target.topics : ['sport']), 3, rng)
  if (distractors.length < 2) return null
  const options = shuffled([target.name, ...distractors.map(c => c.name)], rng).map(name => ({ hr: name, en: name }))
  if (!optionsValid(options)) return null
  const loc = target.settlementName
  return {
    id: questionId('klub-mjesto', 'club', target.id),
    gameId: 'klub-mjesto',
    card: questionCardKey('klub-mjesto', target.id),
    prompt: {
      hr: `Koji klub igra u ${loc}?`,
      en: `Which club plays in ${loc}?`
    },
    options,
    correct: options.findIndex(o => o.hr === target.name),
    explanation: {
      hr: `U ${loc} igra ${target.name}.`,
      en: `${target.name} plays in ${loc}.`
    },
    archivePath: atlasSettlementPath(target.settlementSlug)
  }
}

function klubLigaQuestion(pool: CardPool, target: PoolClub, rng: Rng): GameQuestion | null {
  const season = target.seniorSeason
  if (!season) return null
  const all = poolClubs(pool, ['sport']).filter(c => c.seniorSeason)
  const competitions = new Set<string>()
  const distractorNames: string[] = []
  for (const club of shuffled(all.filter(c => c.id !== target.id), rng)) {
    const comp = club.seniorSeason!.competition
    if (comp === season.competition || competitions.has(comp)) continue
    competitions.add(comp)
    distractorNames.push(comp)
    if (distractorNames.length >= 3) break
  }
  if (distractorNames.length < 2) return null
  const options = shuffled([season.competition, ...distractorNames], rng).map(name => ({ hr: name, en: name }))
  if (!optionsValid(options)) return null
  return {
    id: questionId('klub-liga', 'club', target.id),
    gameId: 'klub-liga',
    card: questionCardKey('klub-liga', target.id),
    prompt: {
      hr: `U kojoj ligi ${target.name} igra u sezoni ${season.seasonLabel}?`,
      en: `Which league does ${target.name} play in during ${season.seasonLabel}?`
    },
    options,
    correct: options.findIndex(o => o.hr === season.competition),
    explanation: {
      hr: `${target.name} u sezoni ${season.seasonLabel} igra u ligi ${season.competition}.`,
      en: `${target.name} plays in ${season.competition} in ${season.seasonLabel}.`
    }
  }
}

function klubOdakleQuestion(pool: CardPool, target: PoolClub, difficulty: Difficulty, rng: Rng): GameQuestion | null {
  const settlementNames = new Set(pool.settlements.map(s => s.name))
  let names = shuffled([...settlementNames].filter(n => n !== target.settlementName), rng).slice(0, 3)
  if (difficulty === 'tesko') {
    const sameMunicipality = pool.settlements.filter(s => s.municipalityId === target.municipalityId && s.name !== target.settlementName)
    names = shuffled(sameMunicipality.length >= 3 ? sameMunicipality : pool.settlements.filter(s => s.name !== target.settlementName), rng).slice(0, 3).map(s => s.name)
  }
  if (names.length < 2) return null
  const options = shuffled([target.settlementName, ...names], rng).map(name => ({ hr: name, en: name }))
  if (!optionsValid(options)) return null
  return {
    id: questionId('klub-odakle', 'club', target.id),
    gameId: 'klub-odakle',
    card: questionCardKey('klub-odakle', target.id),
    prompt: {
      hr: `Odakle je ${target.name}?`,
      en: `Where is ${target.name} from?`
    },
    options,
    correct: options.findIndex(o => o.hr === target.settlementName),
    explanation: {
      hr: `${target.name} dolazi iz naselja ${target.settlementName}.`,
      en: `${target.name} is from ${target.settlementName}.`
    },
    archivePath: atlasSettlementPath(target.settlementSlug)
  }
}

function generateOne(
  game: GameId,
  pool: CardPool,
  options: GenerateQuestionsOptions,
  targetKey?: CardKey
): GameQuestion | null {
  const { topics, difficulty, rng, exclude = new Set<CardKey>(), wordStatus } = options

  if (game === 'znacenje' || game === 'rijec') {
    let words = verifiedWords(pool, topics, wordStatus).filter(w => !exclude.has(w.key))
    if (targetKey) {
      const fixed = words.find(w => w.key === targetKey)
      if (!fixed) return null
      words = [fixed]
    }
    const target = targetKey ? words[0]! : pickWordTarget(words, difficulty, rng)
    if (!target || exclude.has(target.key)) return null
    return game === 'znacenje'
      ? znacenjeQuestion(pool, target, difficulty, rng, wordStatus)
      : rijecQuestion(pool, target, difficulty, rng, wordStatus)
  }

  if (game === 'opcina') {
    let list = places(pool, topics).filter(p => !exclude.has(p.key))
    if (targetKey) {
      const fixed = list.find(p => p.key === targetKey)
      if (!fixed) return null
      list = [fixed]
    }
    const target = targetKey ? list[0]! : pickPlaceTarget(list, difficulty, rng)
    if (!target) return null
    return opcinaQuestion(pool, target, difficulty, rng)
  }

  if (game === 'crkva') {
    let list = churchItems(pool, topics).filter(i => !exclude.has(i.key))
    if (targetKey) {
      const fixed = list.find(i => i.key === targetKey)
      if (!fixed) return null
      list = [fixed]
    }
    const target = targetKey ? list[0]! : pickItemTarget(list, difficulty, rng)
    if (!target) return null
    return crkvaQuestion(pool, target, difficulty, rng)
  }

  if (game === 'karta-koje') {
    const list = places(pool, topics).filter(p => !exclude.has(p.key))
    const target = targetKey ? list.find(p => p.key === targetKey) : pickPlaceTarget(list, difficulty, rng)
    if (!target) return null
    return kartaKojeQuestion(pool, target, difficulty, rng)
  }

  if (game === 'karta-tocke') {
    const list = places(pool, topics).filter(p => !exclude.has(questionCardKey('karta-tocke', p.id)))
    const target = targetKey
      ? list.find(p => questionCardKey('karta-tocke', p.id) === targetKey)
      : pickPlaceTarget(list, difficulty, rng)
    if (!target) return null
    return kartaTockeQuestion(pool, target, difficulty, rng)
  }

  if (game === 'klub-mjesto') {
    const list = uniqueSettlementTargets(poolClubs(pool, topics)).filter(c => !exclude.has(questionCardKey('klub-mjesto', c.id)))
    const target = targetKey
      ? list.find(c => questionCardKey('klub-mjesto', c.id) === targetKey)
      : shuffled(list, rng)[0]
    if (!target) return null
    return klubMjestoQuestion(pool, target, rng)
  }

  if (game === 'klub-liga') {
    const list = poolClubs(pool, topics).filter(c => c.seniorSeason && !exclude.has(questionCardKey('klub-liga', c.id)))
    const target = targetKey
      ? list.find(c => questionCardKey('klub-liga', c.id) === targetKey)
      : shuffled(list, rng)[0]
    if (!target?.seniorSeason) return null
    return klubLigaQuestion(pool, target, rng)
  }

  if (game === 'klub-odakle') {
    const list = poolClubs(pool, topics).filter(c => !exclude.has(questionCardKey('klub-odakle', c.id)))
    const target = targetKey
      ? list.find(c => questionCardKey('klub-odakle', c.id) === targetKey)
      : shuffled(list, rng)[0]
    if (!target) return null
    return klubOdakleQuestion(pool, target, difficulty, rng)
  }

  if (game === 'osoba') {
    let list = poolPersons(pool, topics).filter(p => !exclude.has(p.key))
    if (targetKey) {
      const fixed = list.find(p => p.key === targetKey)
      if (!fixed) return null
      list = [fixed]
    }
    const target = targetKey ? list[0]! : pickPersonTarget(list, rng)
    if (!target) return null
    return osobaQuestion(pool, target, difficulty, rng)
  }

  return null
}

/** One multiple-choice question for a learn review card (meanings, units or settlements). */
export function questionForLearnReview(pool: CardPool, cardKey: CardKey, rng: Rng): GameQuestion | null {
  const card = pool.cards.find(c => c.key === cardKey)
  if (!card) return null
  const topics = card.topics.length ? [...card.topics] : (['rijeci', 'mjesta', 'bastina'] as TopicId[])
  const base: GenerateQuestionsOptions = { topics, difficulty: 'srednje', rng, count: 1 }
  if (card.kind === 'word') return generateOne('znacenje', pool, base, cardKey)
  if (card.kind === 'place') return generateOne('opcina', pool, base, cardKey)
  if (card.kind === 'item') return generateOne('crkva', pool, base, cardKey)
  return null
}

export function generateQuestions(game: GameId, pool: CardPool, options: GenerateQuestionsOptions): GameQuestion[] {
  const { count, rng, exclude = new Set<CardKey>(), topics, wordStatus } = options
  if (count <= 0) return []

  let candidates: CardKey[] = []
  if (game === 'znacenje' || game === 'rijec') {
    candidates = verifiedWords(pool, topics, wordStatus).map(w => w.key)
  } else if (game === 'opcina') {
    candidates = places(pool, topics).map(p => p.key)
  } else if (game === 'crkva') {
    candidates = churchItems(pool, topics).map(i => i.key)
  } else if (game === 'karta-koje') {
    candidates = places(pool, topics).map(p => p.key)
  } else if (game === 'karta-tocke') {
    candidates = places(pool, topics).map(p => questionCardKey('karta-tocke', p.id))
  } else if (game === 'klub-mjesto') {
    candidates = uniqueSettlementTargets(poolClubs(pool, topics)).map(c => questionCardKey('klub-mjesto', c.id))
  } else if (game === 'klub-liga') {
    candidates = poolClubs(pool, topics).filter(c => c.seniorSeason).map(c => questionCardKey('klub-liga', c.id))
  } else if (game === 'klub-odakle') {
    candidates = poolClubs(pool, topics).map(c => questionCardKey('klub-odakle', c.id))
  } else if (game === 'osoba') {
    candidates = poolPersons(pool, topics).map(p => p.key)
  }

  candidates = shuffled(candidates.filter(k => !exclude.has(k)), rng)
  const questions: GameQuestion[] = []
  const used = new Set(exclude)

  for (const key of candidates) {
    if (questions.length >= count) break
    const question = generateOne(game, pool, { ...options, exclude: used }, key)
    if (!question) continue
    if (questions.some(q => q.id === question.id)) continue
    questions.push(question)
    used.add(question.card)
  }

  return questions
}

const ROUND_META = {
  rijeci: { topic: { hr: 'Riječi', en: 'Words' } },
  mjesta: { topic: { hr: 'Mjesta', en: 'Places' } },
  bastina: { topic: { hr: 'Baština', en: 'Heritage' } },
  sport: { topic: { hr: 'Sport i klubovi', en: 'Sport and clubs' } },
  osobe: { topic: { hr: 'Osobe', en: 'Persons' } }
} as const

export function gamesForRound(roundId: keyof typeof ROUND_META, game: GenerateGameId): GameId[] {
  if (roundId === 'rijeci') {
    if (game === 'rijec') return ['rijec']
    if (game === 'znacenje') return ['znacenje']
    if (game === 'mjesovito') return ['znacenje', 'rijec']
    return []
  }
  if (roundId === 'mjesta') {
    if (game === 'opcina' || game === 'mjesovito') return ['opcina']
    if (game === 'karta-koje') return ['karta-koje']
    if (game === 'karta-tocke') return ['karta-tocke']
    return []
  }
  if (roundId === 'bastina') return game === 'crkva' || game === 'mjesovito' ? ['crkva'] : []
  if (roundId === 'sport') {
    if (game === 'klub-mjesto') return ['klub-mjesto']
    if (game === 'klub-liga') return ['klub-liga']
    if (game === 'klub-odakle') return ['klub-odakle']
    if (game === 'mjesovito') return ['klub-mjesto', 'klub-liga', 'klub-odakle']
    return []
  }
  if (roundId === 'osobe') return game === 'osoba' || game === 'mjesovito' ? ['osoba'] : []
  return []
}

export function roundActive(roundId: keyof typeof ROUND_META, topics: GenerateQuestionsOptions['topics'], pool: CardPool): boolean {
  const slugs = slugMap(pool)
  if (roundId === 'sport') {
    const selected = topics.includes('sport')
    if (!selected) return false
    return pool.cards.some(c => c.kind === 'club' && cardMatchesTopicSelection(c, topics, slugs))
  }
  if (roundId === 'osobe') {
    if (!topics.includes('osobe')) return false
    return pool.cards.some(c => c.kind === 'person' && cardMatchesTopicSelection(c, topics, slugs))
  }
  const kind = roundId === 'rijeci' ? 'word' : roundId === 'mjesta' ? 'place' : 'item'
  const root = roundId
  const selected = topics.some(t => t === root || t.startsWith(`${root}-`))
  if (!selected) return false
  return pool.cards.some(c => c.kind === kind && cardMatchesTopicSelection(c, topics, slugs))
}

export function activeRounds(topics: GenerateQuestionsOptions['topics'], pool: CardPool, game: GenerateGameId) {
  return (['rijeci', 'mjesta', 'bastina', 'sport', 'osobe'] as const).filter(id => roundActive(id, topics, pool) && gamesForRound(id, game).length)
}

export function generateGameEnabled(game: GenerateGameId, topics: GenerateQuestionsOptions['topics'], pool: CardPool): boolean {
  return activeRounds(topics, pool, game).length > 0
}

export { ROUND_META }
