import { describe, expect, it } from 'vitest'
import { formatSeasonLabel, validateClub } from '../shared/utils/content/club'
import { computeTopicCounts } from '../shared/utils/learn/topics'
import type { PoolClub } from '../shared/utils/learn/types'
import { generateQuestions } from '../shared/utils/games/questions'
import { fixtureCardPool } from './fixtures/gamePool'
import { mulberry32 } from '../shared/utils/games/rng'

describe('club learn and play', () => {
  it('formatSeasonLabel renders Croatian season', () => {
    expect(formatSeasonLabel('2026/27')).toBe('2026./27.')
  })

  it('validateClub requires a source when publishing', () => {
    const result = validateClub({
      name: 'NK Prigorje', slug: 'nk-prigorje', sport: 'nogomet', settlementId: '00000000-0000-4000-8000-000000000010',
      status: 'published', sourceIds: [], seasons: [], researchNotes: '', verification: 'unverified', noindex: false,
      fullName: null, foundedYear: null, homeGround: null
    })
    expect(result.issues.some(i => i.path === 'sourceIds')).toBe(true)
  })

  it('sport topic goes live when at least eight club cards exist', () => {
    const cards: PoolClub[] = Array.from({ length: 8 }, (_, i) => ({
      kind: 'club',
      key: `club:id-${i}`,
      id: `id-${i}`,
      topics: ['sport'],
      name: `Klub ${i}`,
      slug: `klub-${i}`,
      sport: 'nogomet',
      settlementId: 's1',
      settlementName: `Selo ${i}`,
      settlementSlug: `selo-${i}`,
      municipalityId: 'm1',
      seniorSeason: { season: '2026/27', seasonLabel: '2026./27.', competition: 'III ŽNL-a', team: 'seniori' },
      verification: 'unverified',
      difficulty: 2
    }))
    const topics = computeTopicCounts(cards, [], new Map())
    const sport = topics.find(t => t.id === 'sport')
    expect(sport?.status).toBe('live')
    expect(sport?.count).toBe(8)
  })
})

describe('club challenge questions', () => {
  it('generates league questions that name the season', () => {
    const pool = fixtureCardPool()
    const base = pool.settlements[0]!
    const template: PoolClub = {
      kind: 'club',
      key: 'club:base',
      id: 'base',
      topics: ['sport'],
      name: 'NK Prigorje',
      slug: 'nk-prigorje',
      sport: 'nogomet',
      settlementId: base.id,
      settlementName: base.name,
      settlementSlug: base.slug,
      municipalityId: base.municipalityId,
      seniorSeason: { season: '2026/27', seasonLabel: '2026./27.', competition: 'III ŽNL-a', team: 'seniori' },
      verification: 'verified',
      difficulty: 2
    }
    pool.cards.push(template)
    for (let i = 0; i < 6; i++) {
      pool.cards.push({
        ...template,
        key: `club:extra-${i}`,
        id: `extra-${i}`,
        name: `NK Extra ${i}`,
        slug: `nk-extra-${i}`,
        seniorSeason: { season: '2026/27', seasonLabel: '2026./27.', competition: `Liga ${i}`, team: 'seniori' }
      })
    }
    pool.topics = computeTopicCounts(pool.cards, pool.municipalities.map(m => ({ slug: m.slug, label: m.label })), new Map(pool.municipalities.map(m => [m.id, m.slug])))
    const questions = generateQuestions('klub-liga', pool, { topics: ['sport'], difficulty: 'srednje', count: 1, rng: mulberry32(42) })
    expect(questions[0]?.prompt.hr).toContain('2026./27.')
  })
})
