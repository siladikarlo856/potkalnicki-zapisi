import { describe, expect, it } from 'vitest'
import { CHALLENGEABLE_GAMES } from '../shared/utils/games/definitions'
import { generateQuestions, questionForLearnReview } from '../shared/utils/games/questions'
import { mulberry32 } from '../shared/utils/games/rng'
import type { Difficulty } from '../shared/utils/games/types'
import { computeTopicCounts } from '../shared/utils/learn/topics'
import type { PoolClub, TopicId } from '../shared/utils/learn/types'
import { fixtureCardPool } from './fixtures/gamePool'

/** The fixture pool plus one football club per settlement (two in the first), so every club game has questions. */
function characterisationPool() {
  const pool = fixtureCardPool()
  pool.settlements.forEach((settlement, i) => {
    const club = (n: number): PoolClub => ({
      kind: 'club',
      key: `club:club-${i}-${n}`,
      id: `club-${i}-${n}`,
      topics: ['sport'],
      name: `NK ${settlement.name} ${n}`,
      slug: `nk-${settlement.slug}-${n}`,
      sport: 'nogomet',
      settlementId: settlement.id,
      settlementName: settlement.name,
      settlementSlug: settlement.slug,
      municipalityId: settlement.municipalityId,
      seniorSeason: i % 3 === 2 ? null : { season: '2026/27', seasonLabel: '2026./27.', competition: `Liga ${i % 4}`, team: 'seniori' },
      verification: 'verified',
      difficulty: 2
    })
    pool.cards.push(club(0))
    if (i === 0) pool.cards.push(club(1))
  })
  pool.topics = computeTopicCounts(pool.cards, pool.municipalities.map(m => ({ slug: m.slug, label: m.label })), new Map(pool.municipalities.map(m => [m.id, m.slug])))
  return pool
}

const TOPICS: TopicId[] = ['rijeci', 'mjesta', 'bastina', 'sport', 'osobe']
const DIFFICULTIES: Difficulty[] = ['lako', 'srednje', 'tesko']

// Recorded from the if-chain generator before the Game definition refactor: same pool and seed, same questions.
describe('question generation is stable for a fixed pool and seed', () => {
  const pool = characterisationPool()

  for (const game of CHALLENGEABLE_GAMES) {
    it(`${game} generates the recorded questions`, () => {
      const runs = DIFFICULTIES.flatMap(difficulty => [1, 42].map(seed => ({
        difficulty,
        seed,
        questions: generateQuestions(game, pool, { topics: TOPICS, difficulty, count: 5, rng: mulberry32(seed) })
      })))
      expect(runs.some(run => run.questions.length > 0)).toBe(true)
      expect(runs).toMatchSnapshot()
    })
  }

  it('excludes cards already asked', () => {
    const [first] = generateQuestions('opcina', pool, { topics: TOPICS, difficulty: 'srednje', count: 1, rng: mulberry32(3) })
    const rest = generateQuestions('opcina', pool, { topics: TOPICS, difficulty: 'srednje', count: 5, rng: mulberry32(3), exclude: new Set([first!.card]) })
    expect(rest.map(q => q.card)).not.toContain(first!.card)
    expect(rest).toMatchSnapshot()
  })

  it('learn review asks the recorded question for a word, a place and an item', () => {
    const keys = (['word', 'place', 'item', 'person'] as const).map(kind => pool.cards.find(c => c.kind === kind)!.key)
    expect(keys.map(key => questionForLearnReview(pool, key, mulberry32(9)))).toMatchSnapshot()
  })
})
