import type { ChallengeQuestion, ChallengeText } from '~~/shared/utils/challenge'
import type { ChallengeTemplateContent, ChallengeTemplateRound } from '~~/shared/utils/content/challengeTemplate'
import { CHALLENGE_LIMITS, CHALLENGE_MECHANIC } from '~~/shared/utils/content/challengeTemplate'

// Editing operations of the challenge template dialog, kept apart from the components so they are
// plain functions with tests. They change the content in place (the dialog's form state) and keep
// what the validator requires that an editor cannot see: unique ids and a valid `correct` index.

const emptyText = (): ChallengeText => ({ hr: '', en: '' })

/** Every round and question id in the content. */
export function challengeIds(content: ChallengeTemplateContent) {
  return new Set(content.rounds.flatMap(round => [round.id, ...round.questions.map(question => question.id)]))
}

/** A short random id (`q-3f9a1c2b`) that no round or question of the content uses yet. */
export function newChallengeId(prefix: 'q' | 'round', taken: ReadonlySet<string>) {
  for (;;) {
    const id = `${prefix}-${crypto.randomUUID().slice(0, 8)}`
    if (!taken.has(id)) return id
  }
}

export function blankChallengeQuestion(taken: ReadonlySet<string>): ChallengeQuestion {
  return {
    id: newChallengeId('q', taken),
    mechanic: CHALLENGE_MECHANIC,
    prompt: emptyText(),
    // Four choices, as in the sample set; up to two can be removed.
    options: Array.from({ length: CHALLENGE_LIMITS.maxOptions }, emptyText),
    correct: 0,
    explanation: emptyText()
  }
}

export function blankChallengeRound(taken: ReadonlySet<string>): ChallengeTemplateRound {
  const id = newChallengeId('round', taken)
  return { id, topic: emptyText(), questions: [blankChallengeQuestion(new Set([...taken, id]))] }
}

/** A new template: one round with one question, marked as a sample until it is verified. */
export function blankChallengeTemplateContent(): ChallengeTemplateContent {
  return { sample: true, title: emptyText(), rounds: [blankChallengeRound(new Set())] }
}

export function isBlankText(text: ChallengeText) {
  return !text.hr.trim() && !text.en.trim()
}

/** A question nobody has typed into yet, which can be removed without asking. */
export function isBlankQuestion(question: ChallengeQuestion) {
  return isBlankText(question.prompt) && isBlankText(question.explanation) && question.options.every(isBlankText)
}

/** Moves `list[from]` to `to` in place; out-of-range moves do nothing. */
export function moveItem<T>(list: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return
  const [item] = list.splice(from, 1)
  list.splice(to, 0, item!)
}

export function addRound(content: ChallengeTemplateContent) {
  if (content.rounds.length >= CHALLENGE_LIMITS.rounds) return
  content.rounds.push(blankChallengeRound(challengeIds(content)))
}

export function addQuestion(content: ChallengeTemplateContent, round: number) {
  const target = content.rounds[round]
  if (!target || target.questions.length >= CHALLENGE_LIMITS.questionsPerRound) return
  target.questions.push(blankChallengeQuestion(challengeIds(content)))
}

/** A copy right after the original, with a new id. */
export function duplicateQuestion(content: ChallengeTemplateContent, round: number, index: number) {
  const target = content.rounds[round]
  const question = target?.questions[index]
  if (!target || !question || target.questions.length >= CHALLENGE_LIMITS.questionsPerRound) return
  // A JSON copy: the question is plain data, and the form state is a reactive proxy structuredClone refuses.
  const copy = JSON.parse(JSON.stringify(question)) as ChallengeQuestion
  target.questions.splice(index + 1, 0, { ...copy, id: newChallengeId('q', challengeIds(content)) })
}

export function addOption(question: ChallengeQuestion) {
  if (question.options.length < CHALLENGE_LIMITS.maxOptions) question.options.push(emptyText())
}

/** Removes a choice; the correct answer stays on the same choice, or moves to the first if it was removed. */
export function removeOption(question: ChallengeQuestion, index: number) {
  if (question.options.length <= CHALLENGE_LIMITS.minOptions || index < 0 || index >= question.options.length) return
  question.options.splice(index, 1)
  if (question.correct === index) question.correct = 0
  else if (question.correct > index) question.correct--
}

/** Moves a choice; the correct answer moves with it. */
export function moveOption(question: ChallengeQuestion, from: number, to: number) {
  if (from < 0 || to < 0 || from >= question.options.length || to >= question.options.length) return
  const correct = question.options[question.correct]
  moveItem(question.options, from, to)
  question.correct = Math.max(0, question.options.indexOf(correct!))
}
