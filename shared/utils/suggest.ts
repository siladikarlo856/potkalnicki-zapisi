// Public "suggest" flows (corrections and new-item proposals): which /doprinesi query asks for what, and the
// small pure helpers the dialog and the page share. The payload fields themselves live in contribution.ts.

import type { ContributionKind, ContributionMode, ContributionPayload } from './contribution'
import { CONTRIBUTION_ALLOWED, contributionFields, isContributionKind } from './contribution'

export type SuggestRequest
  = | { mode: 'correction', kind: ContributionKind, id: string }
    | { mode: 'proposal', kind: ContributionKind, settlement?: string, municipality?: string }
    | { mode: 'search' }

type Query = Record<string, unknown>

function single(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/**
 * Reads `/doprinesi?vrsta=...`. Old and new forms:
 * - `vrsta=ispravak&zapis=<old id or uuid>`: a correction of a heritage item (the old link, resolved through the legacy ids);
 * - `vrsta=ispravak&sadrzaj=<kind>&id=<uuid>`: a correction of one row;
 * - `vrsta=ispravak` alone: search for what to correct;
 * - `vrsta=prijedlog&sadrzaj=<kind>[&naselje=<slug>]`: a proposal for a new row.
 * Returns null when the query asks for something else (the word and memory forms) or something not accepted.
 */
export function parseSuggestQuery(query: Query): SuggestRequest | null {
  const vrsta = single(query.vrsta)
  if (vrsta === 'ispravak') {
    const legacy = single(query.zapis)
    if (legacy) return { mode: 'correction', kind: 'heritage_item', id: legacy }
    const kind = single(query.sadrzaj)
    const id = single(query.id)
    if (!kind && !id) return { mode: 'search' }
    if (!isContributionKind(kind) || !id || !CONTRIBUTION_ALLOWED[kind].includes('correction')) return null
    return { mode: 'correction', kind, id }
  }
  if (vrsta === 'prijedlog') {
    const kind = single(query.sadrzaj)
    if (!isContributionKind(kind) || !CONTRIBUTION_ALLOWED[kind].includes('proposal')) return null
    return { mode: 'proposal', kind, settlement: single(query.naselje), municipality: single(query.opcina) }
  }
  return null
}

/** The `/doprinesi` link that opens a suggestion form (what the cards and the old entry points link to). */
export function suggestQuery(mode: ContributionMode, kind: ContributionKind, extra: Record<string, string> = {}) {
  return mode === 'correction'
    ? { vrsta: 'ispravak', sadrzaj: kind, ...extra }
    : { vrsta: 'prijedlog', sadrzaj: kind, ...extra }
}

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  official_registry: 'Službeni registar',
  conservation_study: 'Konzervatorska studija',
  conservation_document: 'Konzervatorski dokument',
  planning_document: 'Prostorni plan',
  development_document: 'Razvojni dokument',
  municipal_source: 'Izvor općine ili grada',
  publication: 'Publikacija',
  dictionary: 'Rječnik',
  interview: 'Razgovor',
  website: 'Mrežna stranica',
  other: 'Drugo'
}

/**
 * The payload to send: a correction carries only the fields the visitor changed from the shown current
 * values, a proposal every non-empty one. Fields outside the kind's whitelist are never included.
 */
export function buildSuggestPayload(kind: ContributionKind, mode: ContributionMode, values: Record<string, string | undefined>, current: Record<string, string | undefined> = {}) {
  const payload: ContributionPayload = {}
  for (const field of contributionFields(kind, mode)) {
    const value = (values[field.key] ?? '').trim()
    if (!value) continue
    if (mode === 'correction' && value === (current[field.key] ?? '').trim()) continue
    payload[field.key] = value
  }
  return payload
}

/** The note a submission needs when the visitor wrote none: what the suggestion is about, in a short line. */
export function suggestSummary(mode: ContributionMode, label: string) {
  return mode === 'correction' ? `Ispravak: ${label}` : `Prijedlog: ${label}`
}
