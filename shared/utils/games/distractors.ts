import type { CardPool, PoolItem, PoolMunicipality, PoolPlace, PoolWord } from '../learn/types'
import { municipalitySlugMap } from '../learn/topics'
import type { Difficulty, GameId } from './types'
import type { Rng } from './rng'
import { shuffled } from './rng'

const EARTH_RADIUS_KM = 6371

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

function normalizedPartOfSpeech(value?: string): string {
  return (value?.split(',')[0] ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('hr')
}

function meaningEn(word: PoolWord): string {
  return word.meaningEn?.trim() || word.meaning
}

function uniqueOptionTexts(options: { hr: string, en: string }[]): boolean {
  for (const lang of ['hr', 'en'] as const) {
    const seen = new Set<string>()
    for (const option of options) {
      const key = option[lang].toLocaleLowerCase(lang)
      if (!key || seen.has(key)) return false
      seen.add(key)
    }
  }
  return true
}

function pickWords(
  pool: readonly PoolWord[],
  target: PoolWord,
  difficulty: Difficulty,
  rng: Rng,
  count: number,
  game: 'znacenje' | 'rijec'
): PoolWord[] {
  const tryRule = (level: Difficulty): PoolWord[] | null => {
    const others = pool.filter(w => w.key !== target.key)
    if (game === 'znacenje' || game === 'rijec') {
      const pos = normalizedPartOfSpeech(target.partOfSpeech)
      let candidates = others
      if (level === 'lako') {
        candidates = others.filter(w => w.category !== target.category && normalizedPartOfSpeech(w.partOfSpeech) !== pos)
        if (!candidates.length) candidates = others.filter(w => w.category !== target.category)
      } else if (level === 'tesko') {
        candidates = others.filter(w => w.category === target.category)
        if (pos) {
          const samePos = candidates.filter(w => normalizedPartOfSpeech(w.partOfSpeech) === pos)
          if (samePos.length >= count) candidates = samePos
        }
      } else {
        if (pos) {
          const samePos = others.filter(w => normalizedPartOfSpeech(w.partOfSpeech) === pos)
          if (samePos.length >= count) candidates = samePos
        }
      }
      const picked: PoolWord[] = []
      const usedHr = new Set<string>()
      const usedEn = new Set<string>()
      for (const word of shuffled(candidates, rng)) {
        const hr = word.meaning.trim()
        const en = meaningEn(word)
        const hrKey = hr.toLocaleLowerCase('hr')
        const enKey = en.toLocaleLowerCase('en')
        if (usedHr.has(hrKey) || usedEn.has(enKey)) continue
        picked.push(word)
        usedHr.add(hrKey)
        usedEn.add(enKey)
        if (picked.length >= count) break
      }
      return picked.length >= 2 ? picked.slice(0, count) : null
    }
    return null
  }
  for (const level of [difficulty, 'srednje' as Difficulty]) {
    const result = tryRule(level)
    if (result) return result
  }
  return shuffled(pool.filter(w => w.key !== target.key), rng).slice(0, count)
}

function pickTargetWord(words: readonly PoolWord[], difficulty: Difficulty, rng: Rng): PoolWord | null {
  if (!words.length) return null
  const prefer = (level: 1 | 2 | 3) => words.filter(w => w.difficulty === level)
  if (difficulty === 'lako' && prefer(1).length) return shuffled(prefer(1), rng)[0]!
  if (difficulty === 'tesko' && prefer(3).length) return shuffled(prefer(3), rng)[0]!
  return shuffled(words, rng)[0]!
}

function pickTargetPlace(places: readonly PoolPlace[], difficulty: Difficulty, rng: Rng): PoolPlace | null {
  if (!places.length) return null
  if (difficulty === 'lako') {
    const easy = places.filter(p => p.seat || p.itemCount >= 1)
    if (easy.length) return shuffled(easy, rng)[0]!
  }
  if (difficulty === 'tesko') {
    const hard = places.filter(p => p.itemCount === 0)
    if (hard.length) return shuffled(hard, rng)[0]!
  }
  return shuffled(places, rng)[0]!
}

function pickMunicipalityDistractors(
  place: PoolPlace,
  municipalities: readonly PoolMunicipality[],
  difficulty: Difficulty,
  rng: Rng
): PoolMunicipality[] {
  const others = municipalities.filter(m => m.id !== place.municipalityId)
  if (others.length < 3) return shuffled(others, rng)
  const ranked = others.map(m => ({ m, d: distanceKm(place.lat, place.lng, m.lat, m.lng) }))
  if (difficulty === 'lako') ranked.sort((a, b) => b.d - a.d)
  else if (difficulty === 'tesko') ranked.sort((a, b) => a.d - b.d)
  else return shuffled(others, rng).slice(0, 3)
  return ranked.slice(0, 3).map(r => r.m)
}

function pickTargetItem(items: readonly PoolItem[], difficulty: Difficulty, rng: Rng): PoolItem | null {
  if (!items.length) return null
  if (difficulty === 'lako') {
    const easy = items.filter(i => i.difficulty === 1)
    if (easy.length) return shuffled(easy, rng)[0]!
  }
  if (difficulty === 'tesko') {
    const hard = items.filter(i => i.difficulty >= 2)
    if (hard.length) return shuffled(hard, rng)[0]!
  }
  return shuffled(items, rng)[0]!
}

function pickSettlementDistractors(
  item: PoolItem,
  pool: CardPool,
  difficulty: Difficulty,
  rng: Rng
): string[] {
  const settlements = pool.settlements.filter(s => s.id !== item.settlementId)
  if (settlements.length < 3) return shuffled(settlements, rng).slice(0, 3).map(s => s.name)

  const placeCoord = (id: string) => {
    const place = pool.cards.find(c => c.kind === 'place' && c.id === id) as PoolPlace | undefined
    return place ? { lat: place.lat, lng: place.lng } : null
  }
  const targetPlace = pool.cards.find(c => c.kind === 'place' && c.id === item.settlementId) as PoolPlace | undefined
  const targetCoord = targetPlace ?? { lat: 0, lng: 0 }

  let candidates = settlements
  if (difficulty === 'lako') {
    candidates = settlements.filter((s) => {
      const otherUnit = pool.cards.some(c => c.kind === 'place' && c.id === s.id && c.municipalityId !== item.municipalityId)
      return otherUnit || s.municipalityId !== item.municipalityId
    })
    if (candidates.length < 3) candidates = settlements.filter(s => s.municipalityId !== item.municipalityId)
  } else if (difficulty === 'tesko') {
    const sameUnit = settlements.filter(s => s.municipalityId === item.municipalityId)
    candidates = sameUnit.length >= 3 ? sameUnit : sameUnit
    if (candidates.length < 3) {
      const ranked = settlements.map(s => ({
        s,
        d: (() => {
          const c = placeCoord(s.id)
          return c ? distanceKm(targetCoord.lat, targetCoord.lng, c.lat, c.lng) : Infinity
        })()
      }))
      ranked.sort((a, b) => a.d - b.d)
      return ranked.slice(0, 3).map(r => r.s.name)
    }
  }

  const picked = shuffled(candidates.length >= 3 ? candidates : settlements, rng).slice(0, 3)
  return picked.map(s => s.name)
}

export function buildWordMeaningOptions(target: PoolWord, distractors: PoolWord[], rng: Rng) {
  const usedEnglish = new Set<string>()
  const texts = [target, ...distractors].map((word) => {
    const hr = word.meaning.trim()
    let en = meaningEn(word)
    if (usedEnglish.has(en.toLocaleLowerCase('en'))) en = hr
    if (usedEnglish.has(en.toLocaleLowerCase('en'))) en = `${en} (${word.headword})`
    usedEnglish.add(en.toLocaleLowerCase('en'))
    return { hr, en }
  })
  const order = shuffled(texts.map((_, i) => i), rng)
  const words = [target, ...distractors]
  const options = order.map(i => texts[i]!)
  return { options, correct: order.indexOf(0), cards: order.map(i => words[i]!.key) }
}

export function buildWordHeadwordOptions(target: PoolWord, distractors: PoolWord[], rng: Rng) {
  const words = shuffled([target, ...distractors], rng)
  const options = words.map(w => w.headword)
  return { options: options.map(hr => ({ hr, en: hr })), correct: options.indexOf(target.headword), cards: words.map(w => w.key) }
}

export function pickWordDistractors(
  game: 'znacenje' | 'rijec',
  target: PoolWord,
  poolWords: readonly PoolWord[],
  difficulty: Difficulty,
  rng: Rng
): PoolWord[] {
  return pickWords(poolWords, target, difficulty, rng, 3, game)
}

export function pickWordTarget(poolWords: readonly PoolWord[], difficulty: Difficulty, rng: Rng): PoolWord | null {
  return pickTargetWord(poolWords, difficulty, rng)
}

export function pickPlaceTarget(places: readonly PoolPlace[], difficulty: Difficulty, rng: Rng): PoolPlace | null {
  return pickTargetPlace(places, difficulty, rng)
}

export function pickPlaceUnitDistractors(
  place: PoolPlace,
  municipalities: readonly PoolMunicipality[],
  difficulty: Difficulty,
  rng: Rng
): PoolMunicipality[] {
  return pickMunicipalityDistractors(place, municipalities, difficulty, rng)
}

export function pickItemTarget(items: readonly PoolItem[], difficulty: Difficulty, rng: Rng): PoolItem | null {
  return pickTargetItem(items, difficulty, rng)
}

export function pickItemSettlementDistractors(
  item: PoolItem,
  pool: CardPool,
  difficulty: Difficulty,
  rng: Rng
): string[] {
  return pickSettlementDistractors(item, pool, difficulty, rng)
}

export function municipalityFor(pool: CardPool, id: string): PoolMunicipality | undefined {
  return pool.municipalities.find(m => m.id === id)
}

export function slugMap(pool: CardPool): Map<string, string> {
  return municipalitySlugMap(pool.municipalities)
}

export function optionsValid(options: { hr: string, en: string }[]): boolean {
  return options.length >= 2 && options.length <= 4 && uniqueOptionTexts(options)
}

export function gameUsesDifficultyFallback(
  game: GameId,
  difficulty: Difficulty,
  attempted: Difficulty
): boolean {
  return attempted !== difficulty && attempted === 'srednje'
}
