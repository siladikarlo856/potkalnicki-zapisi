import { describe, expect, it } from 'vitest'
import { quizDefinitions, quizMechanics, quizTopics } from '../app/data/heritageQuizzes'

describe('heritage quiz catalog', () => {
  it('keeps topics and mechanics as separate dimensions', () => {
    expect(quizTopics.map(topic => topic.slug)).toEqual([
      'rijeci',
      'crkve',
      'povijest',
      'legende',
      'zemljopis',
      'poznati-ljudi',
      'sport'
    ])
    expect(quizMechanics).toEqual(['multiple-choice', 'matching', 'map-pin'])
    expect(quizDefinitions.every(quiz => quizTopics.some(topic => topic.slug === quiz.topic))).toBe(true)
    expect(quizDefinitions.every(quiz => quizMechanics.includes(quiz.mechanic))).toBe(true)
  })

  it('marks the existing Words multiple-choice quiz as playable', () => {
    expect(quizDefinitions).toContainEqual(expect.objectContaining({
      id: 'words-multiple-choice',
      topic: 'rijeci',
      mechanic: 'multiple-choice',
      playable: true,
      path: '/potkalnicko-prigorje/igre/kviz'
    }))
  })

  it('keeps future mechanic examples in the catalog without making them playable', () => {
    expect(quizDefinitions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'churches-matching', topic: 'crkve', mechanic: 'matching', playable: false }),
      expect.objectContaining({ id: 'geography-map-pin', topic: 'zemljopis', mechanic: 'map-pin', playable: false }),
      expect.objectContaining({ id: 'geography-matching', topic: 'zemljopis', mechanic: 'matching', playable: false }),
      expect.objectContaining({ id: 'sport-matching', topic: 'sport', mechanic: 'matching', playable: false })
    ]))
  })
})
