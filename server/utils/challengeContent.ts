import type { WordEntry } from '../../app/types/heritage'
import type { ChallengeContent, QuizChallengeInput } from '../../shared/utils/challenge'
import { challengeSummary, validateChallengeContent } from '../../shared/utils/content/challengeTemplate'

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

/** What the challenge introduction shows before anyone joins: no questions, answers or explanations. */
export function challengeOverview(content: ChallengeContent) {
  return {
    title: content.title,
    sample: content.sample,
    rounds: content.rounds.map(r => ({ topic: r.topic, count: r.questions.length })),
    maxScore: challengeSummary(content).maxScore
  }
}
