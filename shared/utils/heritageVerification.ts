import type { AtlasItemStatus } from '../types/atlas'

const LABEL_KEYS: Record<AtlasItemStatus, string> = {
  unverified: 'pz.heritage.statusUnverified',
  in_review: 'pz.heritage.statusInReview',
  verified: 'pz.heritage.statusVerified',
  needs_update: 'pz.heritage.statusNeedsUpdate'
}

export function heritageVerificationLabelKey(status: AtlasItemStatus) {
  return LABEL_KEYS[status]
}
