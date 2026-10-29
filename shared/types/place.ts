// Public search/review metadata only. The catalog itself is server-only.
export interface PlaceOption {
  id: string
  name: string
  municipality: string
  county: string
}

export interface PlaceSearchResponse {
  version: string
  places: PlaceOption[]
}
