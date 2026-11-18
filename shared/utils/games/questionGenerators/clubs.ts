import type { PoolClub } from '../../learn/types'
import { optionsValid } from '../distractors'
import type { Rng } from '../rng'
import { shuffled } from '../rng'
import { atlasSettlementPath, poolClubs, type QuestionGenerator } from './generator'

function pickClubDistractors(target: PoolClub, pool: PoolClub[], count: number, rng: Rng): PoolClub[] {
  const others = pool.filter(c => c.id !== target.id && c.name !== target.name)
  return shuffled(others, rng).slice(0, count)
}

/** Senior football clubs that are the only one in their settlement, so the settlement names one club. */
function uniqueSettlementTargets(pool: PoolClub[]): PoolClub[] {
  const bySettlement = new Map<string, PoolClub[]>()
  for (const club of pool) {
    if (!club.seniorSeason || club.sport !== 'nogomet') continue
    bySettlement.set(club.settlementId, [...(bySettlement.get(club.settlementId) ?? []), club])
  }
  return [...bySettlement.values()].filter(list => list.length === 1).map(list => list[0]!)
}

/** klub-mjesto: which club plays in the settlement? */
export const klubMjestoQuestions: QuestionGenerator<PoolClub> = {
  candidates: (pool, topics) => uniqueSettlementTargets(poolClubs(pool, topics)),
  question(target, { pool, rng }) {
    const distractors = pickClubDistractors(target, poolClubs(pool, target.topics.length ? target.topics : ['sport']), 3, rng)
    if (distractors.length < 2) return null
    const options = shuffled([target.name, ...distractors.map(c => c.name)], rng).map(name => ({ hr: name, en: name }))
    if (!optionsValid(options)) return null
    const loc = target.settlementName
    return {
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
      archivePath: atlasSettlementPath(pool, target.municipalityId, target.settlementSlug)
    }
  }
}

/** klub-liga: which league does the club play in this season? */
export const klubLigaQuestions: QuestionGenerator<PoolClub> = {
  candidates: (pool, topics) => poolClubs(pool, topics).filter(c => c.seniorSeason),
  question(target, { pool, rng }) {
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
}

/** klub-odakle: which settlement is the club from? */
export const klubOdakleQuestions: QuestionGenerator<PoolClub> = {
  candidates: poolClubs,
  question(target, { pool, difficulty, rng }) {
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
      archivePath: atlasSettlementPath(pool, target.municipalityId, target.settlementSlug)
    }
  }
}
