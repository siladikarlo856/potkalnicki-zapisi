import content from '../../content/heritage/challenge.json'
import type { WordEntry } from '../../app/types/heritage'
import type { ChallengeContent, QuizChallengeInput } from '../../shared/utils/challenge'

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
        || question.options.length < 2 || question.options.length > 4 || !question.options.every(text)
        || !Number.isInteger(question.correct) || question.correct < 0 || question.correct >= question.options.length
        || ['hr', 'en'].some(lang => new Set(question.options.map(o => o[lang as 'hr' | 'en'].trim().toLocaleLowerCase(lang))).size !== question.options.length)) throw new Error('Invalid challenge question')
      ids.add(question.id)
    }
  }
  if (Buffer.byteLength(JSON.stringify(value)) > 256 * 1024) throw new Error('Challenge content too large')
  return value
}

export const currentChallengeContent = validateChallengeContent(content)

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
      }
    }
  })
  return validateChallengeContent({
    version: 1,
    sample: questions.some((_, index) => words.get(input.questions[index]!.id)?.status === 'placeholder'),
    title: { hr: 'Kaj to znači? — izazov', en: 'Kaj to znači? — challenge' },
    rounds: [{ id: 'quiz', topic: { hr: 'Riječi', en: 'Words' }, questions }]
  })
}

export function challengeOverview() {
  return {
    title: currentChallengeContent.title,
    sample: currentChallengeContent.sample,
    rounds: currentChallengeContent.rounds.map(r => ({ topic: r.topic, count: r.questions.length })),
    maxScore: currentChallengeContent.rounds.reduce((n, r) => n + r.questions.length * 100, 0)
  }
}
