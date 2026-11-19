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

const upperFirst = (text: string) => text.charAt(0).toLocaleUpperCase('hr') + text.slice(1)

/** One clue as a single line of copy (the card headline and the clue list of /rijec-dana/). */
export function clueLine(t: Translate, clue: DailyClue, areas: readonly Area[]): string {
  switch (clue.kind) {
    case 'example': return `„${clue.text}“`
    case 'category': return `${upperFirst(t(`daily.category.${clue.category}`))}.`
    case 'variants': return `Čuje se i kao: ${clue.forms.join(', ')}.`
    case 'partOfSpeech': return `Vrsta riječi: ${clue.text}.`
    case 'areas': return `Koristi se u: ${clue.areaIds.map(id => areas.find(area => area.id === id)?.name ?? id).join(', ')}.`
  }
}

const SLOT_NUMBERS: Record<number, string> = { 3: 'tri', 4: 'četiri', 5: 'pet', 6: 'šest', 7: 'sedam', 8: 'osam', 9: 'devet', 10: 'deset', 11: 'jedanaest', 12: 'dvanaest' }

/** "Riječ od šest slova, prvo slovo š": the one sentence a screen reader gets for the slots. */
export function slotsLabel(letters: readonly string[]): string {
  const total = letters.filter(letter => letter !== ' ' && letter !== '-').length
  const shown = letters.filter(letter => letter && letter !== ' ' && letter !== '-')
  const base = `Riječ od ${SLOT_NUMBERS[total] ?? total} slova`
  if (shown.length === 0) return base
  return shown.length === 1 ? `${base}, prvo slovo ${shown[0]}` : `${base}, otkrivena slova: ${shown.join(', ')}`
}

const ORDINALS: Record<number, string> = { 1: 'prvom', 2: 'drugom', 3: 'trećem', 4: 'četvrtom', 5: 'petom' }
export const triesOrdinal = (n: number) => ORDINALS[n] ?? `${n}.`

/** "Niz: 1 dan", "Niz: 2 dana". */
export const streakLabel = (days: number) => `Niz: ${days} ${days % 10 === 1 && days % 100 !== 11 ? 'dan' : 'dana'}`

/** "nedjelja, 15. studenoga" from a Zagreb day key. */
export function dailyDateLabel(day: string): string {
  return new Intl.DateTimeFormat('hr-HR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))
}
