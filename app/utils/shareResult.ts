/** One square per answered question; shows how the round went without naming a single word. */
export function resultEmojiRow(results: readonly boolean[]): string {
  return results.map(right => right ? '🟩' : '🟥').join('')
}

/** The shareable summary: a headline such as "Kaj to znači? 8/10" and the square row. No answers are included. */
export function resultShareText(headline: string, results: readonly boolean[]): string {
  return `${headline}\n${resultEmojiRow(results)}`
}

/**
 * The plain-text message a result leaves the app with (WhatsApp, Viber): the headline, one row of squares, an
 * invitation and the short link. The squares are the only emoji in the product, because WhatsApp and Viber render
 * nothing else reliably. It never includes a word, a meaning or a place.
 */
export function resultShareMessage(input: { headline: string, results: readonly boolean[], invite: string, url: string }): string {
  return `${resultShareText(input.headline, input.results)}\n${input.invite}\n${input.url}`
}

/** Counts behind the squares row, for its text label ("7 točno, 3 netočno"). */
export function resultCounts(results: readonly boolean[]): { ok: number, no: number } {
  const ok = results.filter(Boolean).length
  return { ok, no: results.length - ok }
}

export {
  challengeDifficultyLabel,
  challengeGameLabel,
  challengeInviteShareText,
  challengeMetaTopicSummary,
  challengeTopicSummary
} from '../../shared/utils/challengeShare'
