// "Kod nas se kaže drugačije": a report about how one word is said locally. It travels as an
// ordinary word submission, so the review page shows the word the report is about in its text.

export const VARIANT_REPORT_LIMITS = {
  variant: { max: 200 },
  example: { max: 500 }
} as const

export interface VariantReportParts {
  /** Headword the report is about. */
  headword: string
  /** How the word is said locally. */
  variant: string
  /** Optional example sentence. */
  example?: string
}

/**
 * Submission text for a variant report. `intro` is the localized "Instead of “{word}” we say: "
 * and `exampleLabel` the localized label of the optional sentence.
 */
export function buildVariantReportText(parts: VariantReportParts, intro: string, exampleLabel: string) {
  const example = parts.example?.trim()
  return `${intro}${parts.variant.trim()}${example ? `\n${exampleLabel} ${example}` : ''}`
}
