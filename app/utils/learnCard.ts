import type { WordEntry } from '~/types/heritage'
import type { PoolWord } from '~~/shared/utils/learn/types'
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

export function settlementArchivePath(slug: string): string {
  return `/potkalnicko-prigorje/naselja/${slug}`
}
