import { describe, expect, it } from 'vitest'
import { validateCustom } from '../shared/utils/content/custom'
import { validateFolkText } from '../shared/utils/content/folkText'
import { validateNarrator } from '../shared/utils/content/narrator'
import { validateStory } from '../shared/utils/content/story'
import { createdAdminPath, memoryDraftFields, memoryTitle, MEMORY_DRAFT_ADMIN_PATHS, MEMORY_DRAFT_KINDS } from '../shared/utils/memoryDraft'
import {
  blankCustom, blankFolkText, blankNarrator, blankStory, customToForm, folkTextToForm, formatRecordedOn, moveEntry, narratorToForm,
  numberOrNull, periodValueHint, removeEntry, storyToForm, textOrNull, withPeriodUnit, withRecordedPrecision
} from '../app/utils/intangibleForm'
import { accentTolerantPattern, searchOrFilter, searchPattern } from '../server/utils/content/search'
import type { Story } from '../shared/utils/content/story'

// The pure logic behind the admin pages for Stories, Customs, Folk texts and Narrators: the forms, the date and period
// editors, ordered lists, the Memory → Draft starting point and the narrator search.

const TYPE = '6f1c1c36-3a5e-4b7f-9a52-0d3f0b6c1a10'
const AREA = '0a4f3d2e-8b1c-4d5e-9f60-718293a4b5c6'
const SOURCES = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333']

describe('forms for the three kinds', () => {
  it('starts every kind blank and asks only for what the validator needs', () => {
    expect(validateStory(blankStory()).issues.map(issue => issue.path)).toEqual(['title', 'slug', 'typeId'])
    expect(validateCustom(blankCustom()).issues.map(issue => issue.path)).toEqual(['title', 'slug', 'typeId'])
    expect(validateFolkText(blankFolkText()).issues.map(issue => issue.path)).toEqual(['title', 'slug', 'typeId'])
  })

  it('never forces a full date, and a Published record still needs its text', () => {
    const story = { ...blankStory(), title: 'Bela Kata', typeId: TYPE, recordedPrecision: 'year' as const, recordedYear: 1984 }
    expect(validateStory(story).issues).toEqual([])
    expect(validateStory({ ...story, status: 'published' }).issues.map(issue => issue.path)).toEqual(['textLocal'])
    expect(validateCustom({ ...blankCustom(), title: 'Martinje', typeId: TYPE, status: 'published' }).issues.map(issue => issue.path)).toEqual(['description'])
  })

  it('turns a saved record into a form that validates and keeps its order', () => {
    const saved = {
      id: TYPE, revision: 4, createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z', typeLabel: 'Bajka', placesLabel: 'Gornji Fodrovec',
      ...blankStory(), title: 'Bela Kata', slug: 'bela-kata', typeId: TYPE, textLocal: 'Bila je…', status: 'published' as const,
      areaLinks: [{ areaId: AREA, relation: 'recorded_in' as const }, { areaId: AREA, relation: 'about' as const }],
      narrators: [{ narratorId: SOURCES[0]!, role: 'narrator' as const }, { narratorId: SOURCES[0]!, role: 'collector' as const }],
      sourceIds: [...SOURCES].reverse(), periodUnit: 'decade' as const, periodValue: 1960, period: 'do šezdesetih'
    } satisfies Story
    const form = storyToForm(saved)
    expect(Object.keys(form)).not.toContain('typeLabel')
    expect(Object.keys(form)).not.toContain('revision')
    expect(form.sourceIds).toEqual([...SOURCES].reverse())
    expect(form.sourceIds).not.toBe(saved.sourceIds)
    expect(validateStory(form)).toMatchObject({ issues: [], value: { sourceIds: [...SOURCES].reverse(), periodValue: 1960 } })

    expect(customToForm({ ...saved, ...blankCustom(), id: TYPE, revision: 1, createdAt: '', updatedAt: '', title: 'Martinje', slug: 'martinje', typeId: TYPE, quotes: ['Martinje, vinjek'] }).quotes).toEqual(['Martinje, vinjek'])
    expect(folkTextToForm({ ...saved, ...blankFolkText(), id: TYPE, revision: 1, createdAt: '', updatedAt: '', title: 'Poslovica', slug: 'poslovica', typeId: TYPE, wordIds: ['abc~1'] }).wordIds).toEqual(['abc~1'])
  })
})

describe('recorded-on editor', () => {
  const day = { recordedPrecision: 'day' as const, recordedYear: 1984, recordedMonth: 3, recordedDay: 12 }

  it('clears the parts below the precision, never keeps or guesses them', () => {
    expect(withRecordedPrecision(day, 'month')).toEqual({ recordedPrecision: 'month', recordedYear: 1984, recordedMonth: 3, recordedDay: null })
    expect(withRecordedPrecision(day, 'year')).toEqual({ recordedPrecision: 'year', recordedYear: 1984, recordedMonth: null, recordedDay: null })
    expect(withRecordedPrecision(day, null)).toEqual({ recordedPrecision: null, recordedYear: null, recordedMonth: null, recordedDay: null })
    expect(withRecordedPrecision({ recordedPrecision: 'year', recordedYear: 1984, recordedMonth: null, recordedDay: null }, 'day'))
      .toEqual({ recordedPrecision: 'day', recordedYear: 1984, recordedMonth: null, recordedDay: null })
  })

  it('produces dates the validator accepts, and asks for what is still missing', () => {
    const base = { ...blankStory(), title: 'T', typeId: TYPE }
    expect(validateStory({ ...base, ...withRecordedPrecision(day, 'month') }).issues).toEqual([])
    expect(validateStory({ ...base, ...withRecordedPrecision(day, 'year') }).issues).toEqual([])
    expect(validateStory({ ...base, ...withRecordedPrecision({ recordedPrecision: null, recordedYear: 1984, recordedMonth: null, recordedDay: null }, 'day') }).issues.map(issue => issue.path))
      .toEqual(['recordedMonth', 'recordedDay'])
    expect(validateStory({ ...base, ...withRecordedPrecision({ ...day, recordedDay: 31, recordedMonth: 4 }, 'day') }).issues.map(issue => issue.path)).toEqual(['recordedDay'])
  })

  it('shows the date as far as it is known', () => {
    expect(formatRecordedOn(day)).toBe('12. ožujak 1984.')
    expect(formatRecordedOn(withRecordedPrecision(day, 'month'))).toBe('ožujak 1984.')
    expect(formatRecordedOn(withRecordedPrecision(day, 'year'))).toBe('1984.')
    expect(formatRecordedOn(withRecordedPrecision(day, null))).toBe('')
  })
})

describe('period editor', () => {
  it('clears the value when the unit changes, since 1960 is a decade and 17 a century', () => {
    const period = { period: 'u turska vremena', periodUnit: 'decade' as const, periodValue: 1960 }
    expect(withPeriodUnit(period, 'century')).toEqual({ period: 'u turska vremena', periodUnit: 'century', periodValue: null })
    expect(withPeriodUnit(period, null)).toEqual({ period: 'u turska vremena', periodUnit: null, periodValue: null })
  })

  it('is accepted with a unit and its value, and refused with a unit alone', () => {
    const base = { ...blankCustom(), title: 'T', typeId: TYPE }
    expect(validateCustom({ ...base, period: 'do šezdesetih', periodUnit: 'decade', periodValue: 1960 }).issues).toEqual([])
    expect(validateCustom({ ...base, ...withPeriodUnit(base, 'century') }).issues.map(issue => issue.path)).toEqual(['periodValue'])
    expect(periodValueHint('decade')).toContain('1960')
    expect(periodValueHint('century')).toContain('17')
  })
})

describe('ordered lists and typed values', () => {
  it('moves an entry one place and leaves the ends alone', () => {
    expect(moveEntry(SOURCES, 1, -1)).toEqual([SOURCES[1], SOURCES[0], SOURCES[2]])
    expect(moveEntry(SOURCES, 1, 1)).toEqual([SOURCES[0], SOURCES[2], SOURCES[1]])
    expect(moveEntry(SOURCES, 0, -1)).toEqual(SOURCES)
    expect(moveEntry(SOURCES, 2, 1)).toEqual(SOURCES)
    expect(moveEntry(SOURCES, 5, -1)).toEqual(SOURCES)
    expect(moveEntry(SOURCES, 0, 1)).not.toBe(SOURCES)
  })

  it('removes by position', () => {
    expect(removeEntry(SOURCES, 1)).toEqual([SOURCES[0], SOURCES[2]])
    expect(removeEntry(SOURCES, 9)).toEqual(SOURCES)
  })

  it('treats an empty input as nothing, not as zero', () => {
    expect(numberOrNull('')).toBeNull()
    expect(numberOrNull(undefined)).toBeNull()
    expect(numberOrNull('1984')).toBe(1984)
    expect(numberOrNull(12)).toBe(12)
    expect(numberOrNull('abc')).toBeNull()
    expect(textOrNull('  ')).toBeNull()
    expect(textOrNull('Bela')).toBe('Bela')
  })
})

describe('narrator form', () => {
  it('needs a public description until the narrator has consented to be named', () => {
    const form = { ...blankNarrator(), name: 'Marija Horvat', slug: 'kazivacica-1938' }
    expect(validateNarrator(form).issues.map(issue => issue.path)).toEqual(['publicDescription'])
    expect(validateNarrator({ ...form, consentNamed: true }).issues).toEqual([])
    expect(validateNarrator({ ...form, publicDescription: 'kazivačica, r. 1938., Gornji Fodrovec' }).issues).toEqual([])
  })

  it('refuses the name in the description or the address without consent', () => {
    const form = { ...blankNarrator(), name: 'Marija Horvat', publicDescription: 'Marija iz Fodrovca', slug: 'marija-iz-fodrovca' }
    expect(validateNarrator(form).issues.map(issue => issue.path).sort()).toEqual(['publicDescription', 'slug'])
  })

  it('round-trips a saved narrator, consent note included', () => {
    const saved = {
      id: TYPE, revision: 2, createdAt: '', updatedAt: '', settlementLabel: null, personLabel: null,
      ...blankNarrator(), name: 'Marija Horvat', slug: 'kazivacica', publicDescription: 'kazivačica, r. 1938.', consentNote: 'usmeno, 2026.', bornYear: 1938
    }
    expect(narratorToForm(saved)).toEqual({ ...blankNarrator(), name: 'Marija Horvat', slug: 'kazivacica', publicDescription: 'kazivačica, r. 1938.', consentNote: 'usmeno, 2026.', bornYear: 1938 })
  })
})

describe('Memory → Draft', () => {
  it('offers the three kinds, each edited on its own admin page', () => {
    expect([...MEMORY_DRAFT_KINDS]).toEqual(['story', 'custom', 'folk_text'])
    expect(MEMORY_DRAFT_ADMIN_PATHS).toEqual({ story: '/admin/price', custom: '/admin/obicaji', folk_text: '/admin/usmeni-tekstovi' })
    expect(createdAdminPath('custom')).toBe('/admin/obicaji')
    expect(createdAdminPath('heritage_item')).toBe('/admin/bastina')
  })

  it('titles the Draft from the first sentence of the Memory, or its first words', () => {
    expect(memoryTitle('Na Martinje smo pekli kestenje. Pili smo mošt i pjevali.')).toBe('Na Martinje smo pekli kestenje')
    expect(memoryTitle('\n  Baka je pričala o vilama\nDruga linija.')).toBe('Baka je pričala o vilama')
    const long = `${'riječ '.repeat(40)}kraj`
    expect(memoryTitle(long).length).toBeLessThanOrEqual(81)
    expect(memoryTitle(long).endsWith('…')).toBe(true)
    expect(memoryTitle('   ')).toBe('Sjećanje')
    expect(memoryTitle('Da.')).toBe('Da.')
  })

  it('starts a Draft that passes the kind’s own validator and copies nothing about the sender', () => {
    const memory = { id: 41, text: 'Na Martinje smo pekli kestenje. Pili smo mošt.', place: 'Sveti Petar Orehovec', locale: 'hr' }
    const story = memoryDraftFields('story', memory)
    expect(story).toMatchObject({ title: 'Na Martinje smo pekli kestenje', textStandard: memory.text, verification: 'unverified' })
    expect(story.researchNotes).toBe('Nastalo iz sjećanja #41 (HR). Mjesto kako ga je upisao pošiljatelj: Sveti Petar Orehovec.')
    expect(validateStory({ ...blankStory(), ...story, slug: 'na-martinje', typeId: TYPE, status: 'draft' }).issues).toEqual([])

    const custom = memoryDraftFields('custom', memory)
    expect(custom).toMatchObject({ description: memory.text })
    expect(custom).not.toHaveProperty('textStandard')
    expect(validateCustom({ ...blankCustom(), ...custom, slug: 'na-martinje', typeId: TYPE, status: 'published' }).issues).toEqual([])

    const folk = memoryDraftFields('folk_text', { ...memory, place: null })
    expect(folk.researchNotes).toBe('Nastalo iz sjećanja #41 (HR).')
    expect(validateFolkText({ ...blankFolkText(), ...folk, slug: 'na-martinje', typeId: TYPE, status: 'published' }).issues).toEqual([])
  })
})

describe('narrator search', () => {
  it('folds the query for the search text like the database does', () => {
    expect(searchPattern('Čakovec')).toBe('%cakovec%')
    expect(searchPattern('50%_off')).toBe('%50\\%\\_off%')
  })

  it('lets c, d, s and z match an accented letter in a column that keeps its accents', () => {
    expect(accentTolerantPattern('Šimun')).toBe('%_imun%')
    expect(accentTolerantPattern('Marija')).toBe('%marija%')
    expect(accentTolerantPattern('Čakovec')).toBe('%_akove_%')
  })

  it('builds one filter over the folded text and the real name, quoted so the query cannot reshape it', () => {
    expect(searchOrFilter('Šimun', 'name')).toBe('search_text.ilike."%simun%",name.ilike."%_imun%"')
    // Commas and parentheses are text; a quote and a backslash are escaped for the quoting and the LIKE escape is doubled.
    expect(searchOrFilter('a,b)(c', 'name')).toBe('search_text.ilike."%a,b)(c%",name.ilike."%a,b)(_%"')
    expect(searchOrFilter('x"y', 'name')).toBe('search_text.ilike."%x\\"y%",name.ilike."%x\\"y%"')
    expect(searchOrFilter('50%', 'name')).toBe('search_text.ilike."%50\\\\%%",name.ilike."%50\\\\%%"')
  })
})
