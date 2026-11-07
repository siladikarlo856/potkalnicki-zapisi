import type { AtlasItemStatus } from '../types/atlas'

export type TrustVerificationState = 'unverified' | 'verified' | 'needs_update'

/**
 * The design has three verification states. A record still in review is still being checked,
 * so it shares the welcoming "U provjeri" state.
 */
export function trustVerificationState(status?: AtlasItemStatus): TrustVerificationState {
  if (status === 'verified') return 'verified'
  if (status === 'needs_update') return 'needs_update'
  return 'unverified'
}
