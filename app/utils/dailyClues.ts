import { DAILY_TYPED_CLUES, foldDailyGuess } from '~~/shared/utils/dailyWord'
import type { DailyWordPayload } from '~~/shared/utils/dailyWord'

type Translate = (key: string, named?: Record<string, unknown>) => string

export function pluralForm(locale: string, n: number): 'one' | 'other' {
  const one = locale === 'hr' ? n % 10 === 1 && n % 100 !== 11 : n === 1
  return one ? 'one' : 'other'
}

export const upperFirst = (text: string) => text.charAt(0).toLocaleUpperCase('hr') + text.slice(1)

export function typedClueLines(t: Translate, payload: Pick<DailyWordPayload, 'entry' | 'areas'>): string[] {
  const { entry, areas } = payload
  const tokens = (text: string) => foldDailyGuess(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const answers = [entry.headword, ...entry.variants.map(variant => variant.form)].map(tokens).filter(Boolean)
  const placeNames = areas.filter(area => entry.variants.some(variant => variant.usages.some(usage => usage.areaId === area.id))).map(area => area.name)
  const candidates = [
    entry.meaning.hr.trim() ? `Znači: ${entry.meaning.hr}` : '',
    entry.category ? `${upperFirst(t(`daily.category.${entry.category}`))}.` : '',
    entry.partOfSpeech?.trim() ? `Vrsta riječi: ${entry.partOfSpeech}.` : '',
    placeNames.length ? `Koristi se u: ${placeNames.join(', ')}.` : ''
  ]
  const clues = candidates.filter(text => text && !answers.some(answer => ` ${tokens(text)} `.includes(` ${answer} `)))
  return clues.length ? clues.slice(0, DAILY_TYPED_CLUES) : ['□'.repeat(Math.max(1, [...entry.headword].filter(letter => letter !== ' ' && letter !== '-').length))]
}

const SLOT_NUMBERS: Record<number, string> = { 3: 'tri', 4: 'četiri', 5: 'pet', 6: 'šest', 7: 'sedam', 8: 'osam', 9: 'devet', 10: 'deset', 11: 'jedanaest', 12: 'dvanaest' }

/** "šest" for 6, the number as a word where the slots have a spelled-out name. */
export const letterCount = (total: number) => SLOT_NUMBERS[total] ?? String(total)

/** "Riječ od šest slova, prvo slovo š": the one sentence a screen reader gets for the slots. */
export function slotsLabel(letters: readonly string[]): string {
  const total = letters.filter(letter => letter !== ' ' && letter !== '-').length
  const shown = letters.filter(letter => letter && letter !== ' ' && letter !== '-')
  const base = `Riječ od ${letterCount(total)} slova`
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
