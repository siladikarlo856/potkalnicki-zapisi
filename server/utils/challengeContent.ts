import type { WordEntry } from '../../app/types/heritage'
import type { CardPool, TopicId } from '../../shared/utils/learn/types'
import type { ChallengeContent, ChallengeQuestion, ChallengeSetPublic, GenerateChallengeInput, QuizChallengeInput } from '../../shared/utils/challenge'
import type { ChallengeTemplateContent } from '../../shared/utils/content/challengeTemplate'
import { challengeSummary, validateChallengeContent } from '../../shared/utils/content/challengeTemplate'
import type { Rng } from '../../shared/utils/games/rng'
import {
  activeRounds,
  gamesForRound,
  generateGameEnabled,
  generateQuestions,
  ROUND_META
} from '../../shared/utils/games/questions'
import { CHALLENGEABLE_GAMES } from '../../shared/utils/games/types'
import type { GameQuestion, GenerateGameId } from '../../shared/utils/games/types'

const LENGTHS = new Set([5, 10, 15])
const TOPIC_ID = /^[a-z0-9-]{1,40}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function topicLabel(pool: CardPool, topicId: TopicId, lang: 'hr' | 'en'): string {
  const fromPool = pool.topics.find(t => t.id === topicId)?.label
  if (lang === 'hr') return fromPool ?? topicId
  const en: Record<string, string> = {
    rijeci: 'Words',
    mjesta: 'Places',
    bastina: 'Heritage',
    sport: 'Sport and clubs',
    osobe: 'Persons'
  }
  return en[topicId] ?? fromPool ?? topicId
}

export function parseGenerateInput(body: unknown, pool: CardPool): GenerateChallengeInput {
  if (!isRecord(body)) throw new Error('Invalid generate input')
  const topicsRaw = body.topics
  if (!Array.isArray(topicsRaw) || topicsRaw.length < 1 || topicsRaw.length > 6) throw new Error('Invalid topics')
  const live = new Set(pool.topics.filter(t => t.status === 'live').map(t => t.id))
  const topics: TopicId[] = []
  for (const topic of topicsRaw) {
    if (typeof topic !== 'string' || !TOPIC_ID.test(topic) || !live.has(topic)) throw new Error('Invalid topic')
    if (!topics.includes(topic as TopicId)) topics.push(topic as TopicId)
  }
  const game = body.game
  const challengeable = new Set<string>([...CHALLENGEABLE_GAMES, 'mjesovito'])
  if (typeof game !== 'string' || !challengeable.has(game)) throw new Error('Invalid game')
  const difficulty = body.difficulty
  if (difficulty !== 'lako' && difficulty !== 'srednje' && difficulty !== 'tesko') throw new Error('Invalid difficulty')
  const length = body.length
  if (typeof length !== 'number' || !LENGTHS.has(length)) throw new Error('Invalid length')
  const parsed: GenerateChallengeInput = { topics, game: game as GenerateChallengeInput['game'], difficulty, length: length as GenerateChallengeInput['length'] }
  if (!generateGameEnabled(parsed.game as GenerateGameId, parsed.topics, pool)) throw new Error('Invalid game')
  return parsed
}

function toChallengeQuestion(question: GameQuestion): ChallengeQuestion {
  return {
    id: question.id,
    mechanic: 'multiple-choice',
    prompt: question.prompt,
    options: question.options,
    correct: question.correct,
    explanation: question.explanation,
    card: question.card,
    ...(question.display ? { display: question.display } : {})
  }
}

export function generatedChallengeContent(input: GenerateChallengeInput, pool: CardPool, rng: Rng): ChallengeContent {
  const roundsOrder = activeRounds(input.topics, pool, input.game)
  if (!roundsOrder.length) throw new Error('Not enough content')

  const perRound = roundsOrder.map(() => 0)
  for (let i = 0; i < input.length; i++) perRound[i % roundsOrder.length]!++

  const used = new Set<import('../../shared/utils/learn/types').CardKey>()
  const builtRounds = roundsOrder.map((roundId, index) => {
    const games = gamesForRound(roundId, input.game)
    const need = perRound[index]!
    const questions: ChallengeQuestion[] = []
    let gameIndex = 0
    while (questions.length < need) {
      if (!games.length) break
      const game = games[gameIndex % games.length]!
      const batch = generateQuestions(game, pool, {
        topics: input.topics,
        difficulty: input.difficulty,
        count: 1,
        rng,
        exclude: used
      })
      gameIndex++
      if (!batch.length) {
        if (gameIndex > games.length * 50) break
        continue
      }
      const question = batch[0]!
      if (used.has(question.card)) continue
      used.add(question.card)
      questions.push(toChallengeQuestion(question))
    }
    return {
      id: roundId,
      topic: ROUND_META[roundId].topic,
      questions
    }
  }).filter(round => round.questions.length)

  const questionCount = builtRounds.reduce((sum, round) => sum + round.questions.length, 0)
  if (questionCount < 5) throw new Error('Not enough content')
  if (questionCount > input.length) {
    // trim excess from last rounds
    let extra = questionCount - input.length
    for (let r = builtRounds.length - 1; r >= 0 && extra > 0; r--) {
      const round = builtRounds[r]!
      while (extra > 0 && round.questions.length > 0) {
        round.questions.pop()
        extra--
      }
    }
  }

  const titleHr = input.topics.map(id => topicLabel(pool, id, 'hr')).join(' + ')
  const titleEn = input.topics.map(id => topicLabel(pool, id, 'en')).join(' + ')

  return validateChallengeContent({
    version: 1,
    sample: false,
    title: { hr: `Izazov: ${titleHr}`, en: `Challenge: ${titleEn}` },
    meta: {
      source: 'random',
      topics: input.topics,
      game: input.game,
      difficulty: input.difficulty
    },
    rounds: builtRounds
  })
}

// Challenge snapshots built on the server. Fixed challenges copy the current template
// (challengeTemplates.ts); quiz challenges are rebuilt here from the words just played.

export function quizChallengeContent(input: QuizChallengeInput, activeWords: readonly WordEntry[]): ChallengeContent {
  const fail = () => {
    throw new Error('Invalid quiz challenge')
  }
  if (!input || !Array.isArray(input.questions) || input.questions.length < 1 || input.questions.length > 10
    || !Array.isArray(input.results) || input.results.length !== input.questions.length || !input.results.every(result => typeof result === 'boolean')) fail()
  const words = new Map(activeWords.map(word => [word.id, word]))
  const questionIds = new Set<string>()
  const questions = input.questions.map((question) => {
    if (!question || typeof question.id !== 'string' || question.id.length > 200 || questionIds.has(question.id)
      || !Array.isArray(question.optionIds) || question.optionIds.length < 2 || question.optionIds.length > 4
      || question.optionIds.some(id => typeof id !== 'string') || new Set(question.optionIds).size !== question.optionIds.length
      || !question.optionIds.includes(question.id)) return fail()
    questionIds.add(question.id)
    const entry = words.get(question.id)
    const options = question.optionIds.map(id => words.get(id))
    if (!entry || options.some(option => !option)) return fail()
    const usedEnglish = new Set<string>()
    const texts = options.map((option) => {
      const word = option!
      const hr = word.meaning.hr.trim()
      let en = word.meaning.en?.trim() || hr
      if (usedEnglish.has(en.toLocaleLowerCase('en'))) en = hr
      if (usedEnglish.has(en.toLocaleLowerCase('en'))) en = `${en} (${word.headword})`
      usedEnglish.add(en.toLocaleLowerCase('en'))
      return { hr, en }
    })
    return {
      id: `quiz-${entry.id}`,
      mechanic: 'multiple-choice' as const,
      prompt: { hr: `Što znači riječ „${entry.headword}”?`, en: `What does “${entry.headword}” mean?` },
      options: texts,
      correct: question.optionIds.indexOf(question.id),
      explanation: {
        hr: `„${entry.headword}” znači „${entry.meaning.hr.trim()}”.`,
        en: `“${entry.headword}” means “${entry.meaning.en?.trim() || entry.meaning.hr.trim()}”.`
      },
      card: `word:${entry.id}` as const
    }
  })
  return validateChallengeContent({
    version: 1,
    sample: questions.some((_, index) => words.get(input.questions[index]!.id)?.status === 'placeholder'),
    title: { hr: 'Kaj to znači? — izazov', en: 'Kaj to znači? — challenge' },
    meta: { source: 'quiz', topics: ['rijeci'], game: 'znacenje' },
    rounds: [{ id: 'quiz', topic: { hr: 'Riječi', en: 'Words' }, questions }]
  })
}

/** What the challenge introduction shows before anyone joins: no questions, answers or explanations. */
export function challengeOverview(content: ChallengeContent) {
  return {
    title: content.title,
    sample: content.sample,
    rounds: content.rounds.map(r => ({ topic: r.topic, count: r.questions.length })),
    maxScore: challengeSummary(content).maxScore
  }
}

/** One published template for the set picker; never includes question bodies or answers. */
export function challengeSetPublic(id: string, content: ChallengeTemplateContent): ChallengeSetPublic {
  return {
    id,
    title: content.title,
    sample: content.sample,
    rounds: content.rounds.map(r => ({ topic: r.topic, count: r.questions.length })),
    ...(content.meta ? { meta: content.meta } : {})
  }
}
