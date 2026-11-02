import type { Area } from '../types/heritage'
import type { DailyClue } from '~~/shared/utils/dailyWord'

type Translate = (key: string, named?: Record<string, unknown>) => string

/** The heading and optional body of one clue, shared by the clue list and the screen-reader announcement. */
export function describeClue(t: Translate, clue: DailyClue, areas: readonly Area[]): { label: string, text?: string } {
  switch (clue.kind) {
    case 'example': return { label: t('daily.clue.example'), text: `„${clue.text}“` }
    case 'category': return { label: t('daily.clue.category', { category: t(`daily.category.${clue.category}`) }) }
    case 'variants': return { label: t('daily.clue.variants', { forms: clue.forms.join(', ') }) }
    case 'partOfSpeech': return { label: t('daily.clue.partOfSpeech', { pos: clue.text }) }
    case 'areas': return {
      label: t('daily.clue.areas', { places: clue.areaIds.map(id => areas.find(area => area.id === id)?.name ?? id).join(', ') })
    }
  }
}

export function pluralForm(locale: string, n: number): 'one' | 'other' {
  const one = locale === 'hr' ? n % 10 === 1 && n % 100 !== 11 : n === 1
  return one ? 'one' : 'other'
}
