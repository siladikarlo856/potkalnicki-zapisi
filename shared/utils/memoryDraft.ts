import { CONTRIBUTION_ADMIN_PATHS } from './contribution'
import type { ContributionKind } from './contribution'
import { INTANGIBLE_LIMITS } from './content/intangible'

// A Memory (Sjećanje) is a free-text Contribution; an editor starts a Draft Story, Custom or Folk text from it
// (GLOSSARY.md, "Memory"). These are the kinds a Memory can become, where each is edited, and the fields the Draft
// starts with. The editor then finishes the Draft in the kind's own admin page; publishing it applies the Memory.

export const MEMORY_DRAFT_KINDS = ['story', 'custom', 'folk_text'] as const
export type MemoryDraftKind = typeof MEMORY_DRAFT_KINDS[number]

export function isMemoryDraftKind(value: unknown): value is MemoryDraftKind {
  return (MEMORY_DRAFT_KINDS as readonly unknown[]).includes(value)
}

export const MEMORY_DRAFT_KIND_LABELS: Record<MemoryDraftKind, string> = {
  story: 'Priča',
  custom: 'Običaj',
  folk_text: 'Usmeni tekst'
}

/** The admin page that edits each kind a Memory can become; the inbox deep-links there. */
export const MEMORY_DRAFT_ADMIN_PATHS: Record<MemoryDraftKind, string> = {
  story: '/admin/price',
  custom: '/admin/obicaji',
  folk_text: '/admin/usmeni-tekstovi'
}

/** The admin page that edits what an inbox row created: a Memory's Draft, or a Proposal's. */
export function createdAdminPath(kind: ContributionKind | MemoryDraftKind) {
  return isMemoryDraftKind(kind) ? MEMORY_DRAFT_ADMIN_PATHS[kind] : CONTRIBUTION_ADMIN_PATHS[kind]
}

const TITLE_MAX = 80

/**
 * A working title for the Draft, from the start of the Memory: its first line, cut at the end of the first sentence
 * when that comes early enough, or else at a word boundary. The editor renames it; it only has to be something.
 */
export function memoryTitle(text: string) {
  const line = text.split(/\r?\n/).map(part => part.trim()).find(Boolean) ?? ''
  if (!line) return 'Sjećanje'
  const sentence = /^(.{10,}?[.!?…])(\s|$)/.exec(line)?.[1]
  const first = sentence && sentence.length <= TITLE_MAX ? sentence.replace(/[.!?…]+$/, '') : line
  if (first.length <= TITLE_MAX) return first
  const cut = first.slice(0, TITLE_MAX)
  const boundary = cut.lastIndexOf(' ')
  return `${(boundary > TITLE_MAX / 2 ? cut.slice(0, boundary) : cut).replace(/[\s,;:.-]+$/, '')}…`
}

export interface MemoryDraftSource {
  id: number
  text: string
  /** The place as the sender wrote it. */
  place: string | null
  locale: string
}

/**
 * The fields a Draft starts with: the sender's text as the standard retelling (a Story or Folk text) or the
 * description (a Custom), a working title, and a private note saying where it came from. Nothing else is guessed:
 * the sender's name is never copied (the sender is credited when the Draft is published, and only with consent),
 * and places, narrators and dates are for the editor to set.
 */
export function memoryDraftFields(kind: MemoryDraftKind, memory: MemoryDraftSource) {
  const text = memory.text.trim()
  const note = [
    `Nastalo iz sjećanja #${memory.id} (${memory.locale.toUpperCase()}).`,
    memory.place ? `Mjesto kako ga je upisao pošiljatelj: ${memory.place}.` : ''
  ].filter(Boolean).join(' ')
  return {
    title: memoryTitle(text),
    ...(kind === 'custom' ? { description: text } : { textStandard: text }),
    verification: 'unverified',
    researchNotes: note.slice(0, INTANGIBLE_LIMITS.researchNotes)
  }
}
