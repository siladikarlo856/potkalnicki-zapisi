import type { ContentStatus } from '../utils/content/common'
import type { ContributionChange, ContributionKind } from '../utils/contribution'
import type { Submission, SubmissionStatus, SubmissionType } from '../utils/submission'

// API shapes of the admin inbox (/api/admin/inbox): submissions with what they point at and what they
// created, and the detail an admin applies a correction from.

export interface InboxTarget {
  kind: ContributionKind
  /** Null when a legacy correction's item no longer exists. */
  id: string | null
  label: string
  /** `missing` when the target was deleted since the submission was sent. */
  state: 'ok' | 'missing'
  status: ContentStatus | null
  revision: number | null
}

/** The row an admin has already made from a proposal (a draft, or the published row). */
export interface InboxCreated {
  kind: ContributionKind
  id: string
  label: string
  status: ContentStatus
}

export interface InboxRow extends Submission {
  target: InboxTarget | null
  created: InboxCreated | null
  /** True when "Otvori skicu" makes sense: a proposal, or a plain word or expression sent before proposals existed. */
  canDraft: boolean
}

export interface InboxList {
  rows: InboxRow[]
  total: number
  page: number
  size: number
  counts: { pending: number }
}

export interface InboxFilters {
  status: SubmissionStatus | 'all'
  type?: SubmissionType
  targetKind?: ContributionKind
  q?: string
  page: number
  size: number
}

export interface InboxDetail {
  submission: InboxRow
  /** Field-by-field current and proposed values (corrections) or the proposal's fields. */
  changes: ContributionChange[]
  /** Corrections only: values to put into the target's edit form, in its API field names. */
  patch: Record<string, unknown> | null
  /** The target changed after the sender saw it (its revision is newer than `baseRevision`). */
  stale: boolean
}

export interface InboxDraftResult {
  kind: ContributionKind
  id: string
  created: boolean
}
