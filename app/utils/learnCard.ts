import type { WordEntry } from '~/types/heritage'
import type { CardPool, PoolPlace, PoolWord } from '~~/shared/utils/learn/types'
import { pzPath, pzRoutes, settlementPagePath } from '~~/shared/utils/appRoutes'
import { wordArchivePagePath } from '~~/shared/utils/speech'

/** Map a pool word card to the shape WordFlipCard and WordCorrection expect. */
export function poolWordToEntry(word: PoolWord): WordEntry {
  return {
    id: word.id,
    headword: word.headword,
    meaning: { hr: word.meaning, en: word.meaningEn },
    partOfSpeech: word.partOfSpeech,
    status: word.status === 'verified' ? 'verified' : 'community',
    sources: [],
    variants: word.variants.map((form, i) => ({
      id: `${word.id}-v${i}`,
      form,
      status: word.status === 'verified' ? 'verified' : 'community',
      usages: []
    }))
  }
}

export function wordArchivePath(word: PoolWord): string | undefined {
  return word.slug ? wordArchivePagePath(word.slug) : undefined
}

/** The settlement's page, through its municipality in the pool (the places list when the pool lacks it). */
export function settlementArchivePath(pool: CardPool, place: PoolPlace): string {
  const municipality = pool.municipalities.find(m => m.id === place.municipalityId)
  return municipality ? settlementPagePath(municipality.slug, place.slug) : pzRoutes.places
}

export function personArchivePath(slug: string): string {
  return pzPath(pzRoutes.persons, slug)
}
