/** One square per answered question; shows how the round went without naming a single word. */
export function resultEmojiRow(results: readonly boolean[]): string {
  return results.map(right => right ? '🟩' : '🟥').join('')
}

/** The shareable summary: a headline such as "Kaj to znači? 8/10" and the square row. No answers are included. */
export function resultShareText(headline: string, results: readonly boolean[]): string {
  return `${headline}\n${resultEmojiRow(results)}`
}
