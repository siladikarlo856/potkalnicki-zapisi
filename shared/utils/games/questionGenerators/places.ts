import { unitDative } from '../../learn/topics'
import type { PoolPlace } from '../../learn/types'
import { distanceKm, municipalityFor, optionsValid, pickPlaceUnitDistractors } from '../distractors'
import { shuffled } from '../rng'
import { atlasSettlementPath, places, type QuestionGenerator } from './generator'

/** opcina: which municipality or town is the settlement in? */
export const opcinaQuestions: QuestionGenerator<PoolPlace> = {
  candidates: places,
  question(place, { pool, difficulty, rng }) {
    const unit = municipalityFor(pool, place.municipalityId)
    if (!unit) return null
    const distractors = pickPlaceUnitDistractors(place, pool.municipalities, difficulty, rng)
    if (distractors.length < 1) return null
    const options = shuffled([unit, ...distractors], rng).map(m => ({ hr: m.label, en: m.label }))
    if (!optionsValid(options)) return null
    const correct = options.findIndex(o => o.hr === unit.label)
    const dative = unitDative(unit.slug, unit.label)
    return {
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
}

/** karta-koje: which village is the point on the map? */
export const kartaKojeQuestions: QuestionGenerator<PoolPlace> = {
  candidates: places,
  question(place, { pool, difficulty, rng }) {
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
}

function numberedPointOptions(count: number): { hr: string, en: string }[] {
  return Array.from({ length: count }, (_, index) => ({
    hr: `Točka ${index + 1}`,
    en: `Point ${index + 1}`
  }))
}

/** karta-tocke: which of four numbered points on the map is the village? */
export const kartaTockeQuestions: QuestionGenerator<PoolPlace> = {
  candidates: places,
  question(target, { pool, difficulty, rng }) {
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
}
