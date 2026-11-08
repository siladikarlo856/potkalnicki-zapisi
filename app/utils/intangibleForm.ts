import type { CustomValue, Custom } from '#shared/utils/content/custom'
import type { FolkText, FolkTextValue } from '#shared/utils/content/folkText'
import type { IntangibleCommon, Period, PeriodUnit, RecordedOn, RecordedPrecision } from '#shared/utils/content/intangible'
import type { Narrator, NarratorValue } from '#shared/utils/content/narrator'
import type { Story, StoryValue } from '#shared/utils/content/story'

// What the admin forms for Stories, Customs and Folk texts share: their blank forms, how a saved record becomes a
// form, and the small pure rules of the editors (date precision, period unit, list order). The validators and the
// vocabulary live in `shared/utils/content/`; this file is only the form side.

/** The state the shared editor sections work on: what every kind has, plus the fields only some kinds have. */
export type IntangibleFormState = IntangibleCommon & Partial<Period> & {
  typeId: string
  textLocal?: string | null
  textStandard?: string | null
  occasionId?: string | null
  description?: string | null
  quotes?: string[]
  customId?: string | null
  wordIds?: string[]
}

/**
 * The fields every kind starts with. A new record is a Draft in the form: the dialog's "Spremi skicu" validates the form
 * as it stands, so the Published rules (a text, a description) apply only once the record is Published.
 */
function blankCommon(): IntangibleCommon {
  return {
    title: '', slug: '', verification: 'unverified', researchNotes: '', noindex: false, status: 'draft',
    recordedPrecision: null, recordedYear: null, recordedMonth: null, recordedDay: null,
    areaLinks: [], narrators: [], authorIds: [], itemIds: [], themeIds: [], sourceIds: []
  }
}

const NO_PERIOD: Period = { period: null, periodUnit: null, periodValue: null }

export const blankStory = (): StoryValue => ({ ...blankCommon(), typeId: '', textLocal: null, textStandard: null, ...NO_PERIOD })
export const blankCustom = (): CustomValue => ({ ...blankCommon(), typeId: '', occasionId: null, description: null, quotes: [], ...NO_PERIOD })
export const blankFolkText = (): FolkTextValue => ({ ...blankCommon(), typeId: '', customId: null, textLocal: null, textStandard: null, wordIds: [] })

function commonOf(record: IntangibleCommon): IntangibleCommon {
  return {
    title: record.title,
    slug: record.slug,
    verification: record.verification,
    researchNotes: record.researchNotes ?? '',
    noindex: record.noindex,
    status: record.status,
    recordedPrecision: record.recordedPrecision,
    recordedYear: record.recordedYear,
    recordedMonth: record.recordedMonth,
    recordedDay: record.recordedDay,
    areaLinks: (record.areaLinks ?? []).map(link => ({ ...link })),
    narrators: (record.narrators ?? []).map(link => ({ ...link })),
    authorIds: [...(record.authorIds ?? [])],
    itemIds: [...(record.itemIds ?? [])],
    themeIds: [...(record.themeIds ?? [])],
    sourceIds: [...(record.sourceIds ?? [])]
  }
}

const periodOf = (record: Period): Period => ({ period: record.period, periodUnit: record.periodUnit, periodValue: record.periodValue })

/** The form for a saved record: the editable fields only (the labels the list shows are not sent back). */
export const storyToForm = (story: Story): StoryValue => ({
  ...commonOf(story), typeId: story.typeId, textLocal: story.textLocal, textStandard: story.textStandard, ...periodOf(story)
})

export const customToForm = (custom: Custom): CustomValue => ({
  ...commonOf(custom), typeId: custom.typeId, occasionId: custom.occasionId, description: custom.description, quotes: [...(custom.quotes ?? [])], ...periodOf(custom)
})

export const folkTextToForm = (folkText: FolkText): FolkTextValue => ({
  ...commonOf(folkText), typeId: folkText.typeId, customId: folkText.customId, textLocal: folkText.textLocal,
  textStandard: folkText.textStandard, wordIds: [...(folkText.wordIds ?? [])]
})

export const blankNarrator = (): NarratorValue => ({
  name: '', slug: '', publicDescription: null, consentNamed: false, consentNote: null, living: true, bornYear: null,
  settlementId: null, personId: null, verification: 'unverified', researchNotes: '', noindex: false, status: 'draft'
})

export const narratorToForm = (narrator: Narrator): NarratorValue => ({
  name: narrator.name,
  slug: narrator.slug,
  publicDescription: narrator.publicDescription,
  consentNamed: narrator.consentNamed,
  consentNote: narrator.consentNote,
  living: narrator.living,
  bornYear: narrator.bornYear,
  settlementId: narrator.settlementId,
  personId: narrator.personId,
  verification: narrator.verification,
  researchNotes: narrator.researchNotes ?? '',
  noindex: narrator.noindex,
  status: narrator.status
})

// ---- Recorded on -----------------------------------------------------------------------------------------------------

export const MONTH_NAMES = [
  'siječanj', 'veljača', 'ožujak', 'travanj', 'svibanj', 'lipanj', 'srpanj', 'kolovoz', 'rujan', 'listopad', 'studeni', 'prosinac'
] as const

/**
 * The date fields after the precision changes: a part below the new precision is cleared, never kept or guessed, so the
 * form can only hold what the database accepts (a Year has no month, a Month has no day). A precision of `null` means
 * the date is not known at all. The year the editor already typed is kept.
 */
export function withRecordedPrecision(state: RecordedOn, precision: RecordedPrecision | null): RecordedOn {
  if (!precision) return { recordedPrecision: null, recordedYear: null, recordedMonth: null, recordedDay: null }
  return {
    recordedPrecision: precision,
    recordedYear: state.recordedYear,
    recordedMonth: precision === 'year' ? null : state.recordedMonth,
    recordedDay: precision === 'day' ? state.recordedDay : null
  }
}

/** The date as far as it is known, for a list: "12. ožujka 1960.", "ožujak 1960." or "1960."; empty when unknown. */
export function formatRecordedOn(value: RecordedOn) {
  if (!value.recordedPrecision || value.recordedYear === null) return ''
  const month = value.recordedMonth
  if (value.recordedPrecision === 'year' || month === null) return `${value.recordedYear}.`
  if (value.recordedPrecision === 'month' || value.recordedDay === null) return `${MONTH_NAMES[month - 1] ?? month} ${value.recordedYear}.`
  return `${value.recordedDay}. ${MONTH_NAMES[month - 1] ?? month} ${value.recordedYear}.`
}

// ---- Period ---------------------------------------------------------------------------------------------------------

/** The period fields after the unit changes: the value belongs to a unit (1960 is a decade, 17 a century), so it is cleared. */
export function withPeriodUnit(state: Period, unit: PeriodUnit | null): Period {
  return { period: state.period, periodUnit: unit, periodValue: null }
}

export function periodValueHint(unit: PeriodUnit) {
  return unit === 'decade' ? 'Prva godina desetljeća, npr. 1960 za 1960-e.' : 'Broj stoljeća od 1 do 21, npr. 17 za 1601.–1700.'
}

// ---- Ordered lists ----------------------------------------------------------------------------------------------------

/** The list with the entry at `index` moved one place up (`-1`) or down (`1`); out of range leaves it as it is. */
export function moveEntry<T>(list: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list]
  const next = [...list]
  const [entry] = next.splice(index, 1)
  next.splice(target, 0, entry!)
  return next
}

export function removeEntry<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, position) => position !== index)
}

/** An empty or whitespace-only text is null (the shared validators store nothing for it). */
export function textOrNull(value: string) {
  return value.trim() ? value : null
}

/** A number typed into an input: an empty field is null; anything else is passed on for the validator to judge. */
export function numberOrNull(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isNaN(number) ? null : number
}
