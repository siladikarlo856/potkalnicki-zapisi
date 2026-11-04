import type { Area } from '../../app/types/heritage'
import type { PublicWordEntry } from '../utils/word'

export interface WordPageRelated {
  slug: string
  headword: string
  meaning: string
  path: string
}

export interface WordPageResponse {
  word: PublicWordEntry
  areas: Area[]
  related: WordPageRelated[]
}
