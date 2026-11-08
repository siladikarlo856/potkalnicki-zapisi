import { pzRoutes } from './appRoutes'

// The public side of intangible heritage (Priče i običaji): the three kinds, the paths of their pages and how a
// record's date and period read. Shared by the server's public queries and the pages, so a link and a label are
// written once. The vocabulary is GLOSSARY.md, "Intangible heritage".

export const INTANGIBLE_KINDS = ['story', 'custom', 'folk_text'] as const
export type IntangibleKind = typeof INTANGIBLE_KINDS[number]

/** The path segment of each kind's detail pages: /price-i-obicaji/prica/<slug>. */
export const INTANGIBLE_KIND_SLUGS: Record<IntangibleKind, string> = {
  story: 'prica',
  custom: 'obicaj',
  folk_text: 'usmeni-tekst'
}

export const INTANGIBLE_KIND_LABELS: Record<IntangibleKind, string> = {
  story: 'Priča',
  custom: 'Običaj',
  folk_text: 'Usmeni tekst'
}

export const INTANGIBLE_KIND_PLURALS: Record<IntangibleKind, string> = {
  story: 'Priče',
  custom: 'Običaji',
  folk_text: 'Usmeni tekstovi'
}

export function intangibleKindFromSlug(slug: string): IntangibleKind | null {
  return INTANGIBLE_KINDS.find(kind => INTANGIBLE_KIND_SLUGS[kind] === slug) ?? null
}

export const intangiblePath = (kind: IntangibleKind, slug: string) => `${pzRoutes.intangible}/${INTANGIBLE_KIND_SLUGS[kind]}/${slug}`
export const themePath = (slug: string) => `${pzRoutes.intangible}/tema/${slug}`
export const narratorPath = (slug: string) => `${pzRoutes.intangible}/kazivac/${slug}`

export interface RecordedOnParts {
  precision: 'year' | 'month' | 'day' | null
  year: number | null
  month: number | null
  day: number | null
}

const MONTHS = ['siječanj', 'veljača', 'ožujak', 'travanj', 'svibanj', 'lipanj', 'srpanj', 'kolovoz', 'rujan', 'listopad', 'studeni', 'prosinac']
const MONTHS_GENITIVE = ['siječnja', 'veljače', 'ožujka', 'travnja', 'svibnja', 'lipnja', 'srpnja', 'kolovoza', 'rujna', 'listopada', 'studenoga', 'prosinca']

/**
 * When a record was told or collected, at the precision it is known and no finer: "1987.", "ožujak 1987." or
 * "12. ožujka 1987.". A part below the precision is never shown, even if a row somehow holds one.
 */
export function formatRecordedOn(on: RecordedOnParts): string | null {
  if (!on.precision || on.year === null) return null
  if (on.precision === 'year') return `${on.year}.`
  const month = on.month !== null ? MONTHS[on.month - 1] : undefined
  if (!month) return `${on.year}.`
  if (on.precision === 'month' || on.day === null) return `${month} ${on.year}.`
  return `${on.day}. ${MONTHS_GENITIVE[on.month! - 1]} ${on.year}.`
}

/** The era a record is set in or practised: the words people use, else the approximate decade or century. */
export function periodLabel(period: string | null, unit: 'decade' | 'century' | null, value: number | null): string | null {
  if (period) return period
  if (unit === 'decade' && value !== null) return `${value}-ih (približno)`
  if (unit === 'century' && value !== null) return `${value}. stoljeće (približno)`
  return null
}
