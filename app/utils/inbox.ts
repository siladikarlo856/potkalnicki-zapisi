import type { SubmissionIntent, SubmissionStatus, SubmissionType } from '~~/shared/utils/submission'

// Labels of the admin inbox (/admin/prijedlozi).

export const SUBMISSION_TYPE_LABELS: Record<SubmissionType, string> = {
  word: 'Riječ',
  expression: 'Izraz',
  memory: 'Sjećanje ili priča',
  other: 'Nešto drugo',
  correction: 'Ispravak',
  proposal: 'Prijedlog novog zapisa'
}

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus | 'all', string> = {
  pending: 'Na čekanju',
  approved: 'Odobreno',
  rejected: 'Odbijeno',
  all: 'Sve'
}

export const SUBMISSION_STATUS_COLORS = { pending: 'warning', approved: 'success', rejected: 'neutral' } as const

/** What a contribution from the daily word says about its word. */
export const INTENT_LABELS: Record<SubmissionIntent, string> = {
  variant: 'Drugačiji oblik',
  usage: 'Potvrda upotrebe'
}
