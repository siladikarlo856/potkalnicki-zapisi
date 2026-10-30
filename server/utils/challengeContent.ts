import content from '../../content/heritage/challenge.json'
import type { ChallengeContent } from '../../shared/utils/challenge'

// Fail the build/start rather than silently publishing a malformed editorial file.
export function validateChallengeContent(input: unknown): ChallengeContent {
  const value = input as ChallengeContent
  const text = (v: unknown) => !!v && typeof v === 'object'
    && ['hr', 'en'].every(lang => typeof (v as Record<string, unknown>)[lang] === 'string'
      && ((v as Record<string, string>)[lang]?.trim().length ?? 0) > 0
      && ((v as Record<string, string>)[lang]?.length ?? 0) <= 2000)
  const ids = new Set<string>()
  if (!value || !Number.isInteger(value.version) || value.version < 1 || typeof value.sample !== 'boolean'
    || !text(value.title) || !Array.isArray(value.rounds) || !value.rounds.length || value.rounds.length > 10) throw new Error('Invalid challenge content')
  for (const round of value.rounds) {
    if (!round.id || !text(round.topic) || !Array.isArray(round.questions) || !round.questions.length || round.questions.length > 20) throw new Error('Invalid challenge round')
    for (const question of round.questions) {
      if (!question.id || ids.has(question.id) || question.mechanic !== 'multiple-choice'
        || !text(question.prompt) || !text(question.explanation) || !Array.isArray(question.options)
        || question.options.length !== 4 || !question.options.every(text)
        || !Number.isInteger(question.correct) || question.correct < 0 || question.correct > 3
        || ['hr', 'en'].some(lang => new Set(question.options.map(o => o[lang as 'hr' | 'en'].trim().toLocaleLowerCase(lang))).size !== 4)) throw new Error('Invalid challenge question')
      ids.add(question.id)
    }
  }
  if (Buffer.byteLength(JSON.stringify(value)) > 256 * 1024) throw new Error('Challenge content too large')
  return value
}

export const currentChallengeContent = validateChallengeContent(content)

export function challengeOverview() {
  return {
    title: currentChallengeContent.title,
    sample: currentChallengeContent.sample,
    rounds: currentChallengeContent.rounds.map(r => ({ topic: r.topic, count: r.questions.length })),
    maxScore: currentChallengeContent.rounds.reduce((n, r) => n + r.questions.length * 100, 0)
  }
}
