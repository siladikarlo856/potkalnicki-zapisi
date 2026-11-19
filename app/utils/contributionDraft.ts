export const CONTRIBUTION_DRAFT_STORAGE_KEY = 'pz-contribute-draft/v1'

export interface ContributionDraft {
  text: string
  type?: string
  placeId: string | null
  placeQuery: string
  name: string
  contact: string
}
