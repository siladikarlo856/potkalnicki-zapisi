import { describe, expect, it } from 'vitest'
import { isContentKind } from '../shared/utils/content/common'
import { validateCustom } from '../shared/utils/content/custom'
import { validateFolkText } from '../shared/utils/content/folkText'
import { HISTORY_FIELDS, HISTORY_KINDS, HISTORY_KIND_META } from '../shared/utils/content/history'
import { INTANGIBLE_LIMITS, parseRecordedOn } from '../shared/utils/content/intangible'
import {
  validateCustomType, validateFolkTextType, validateOccasion, validateStoryType, validateTheme
} from '../shared/utils/content/intangibleList'
import { validateStory } from '../shared/utils/content/story'

const TYPE = '6f1c1c36-3a5e-4b7f-9a52-0d3f0b6c1a10'
const AREA = '92140ed6-6420-81d0-8661-91ce0c257f5f'
const PERSON = 'cb2f662f-3359-8378-b5f3-448d25991ec6'
const SOURCE = '466778a5-5665-86a1-b60c-608c05383f11'

const story = (extra: Record<string, unknown> = {}) => ({ title: 'Vrag na Kalniku', typeId: TYPE, textLocal: 'Bil je jen put...', ...extra })
const paths = (issues: Array<{ path: string }>) => issues.map(issue => issue.path)

describe('validateStory', () => {
  it('derives the slug, trims texts, defaults to a Draft and an Unverified record, and projects known fields only', () => {
    const { value, issues } = validateStory(story({ textLocal: '  Bil je jen put...  ', textStandard: '  ', id: 'ignored', extra: true }))
    expect(issues).toEqual([])
    expect(value).toEqual({
      title: 'Vrag na Kalniku',
      slug: 'vrag-na-kalniku',
      typeId: TYPE,
      textLocal: 'Bil je jen put...',
      textStandard: null,
      period: null,
      periodUnit: null,
      periodValue: null,
      recordedPrecision: null,
      recordedYear: null,
      recordedMonth: null,
      recordedDay: null,
      verification: 'unverified',
      researchNotes: '',
      noindex: false,
      status: 'draft',
      areaLinks: [],
      people: [],
      itemIds: [],
      themeIds: [],
      sourceIds: []
    })
  })

  it('needs a title and a type, and a text only to publish (a Draft made from a Memory may be empty)', () => {
    expect(paths(validateStory({}).issues)).toEqual(['title', 'slug', 'typeId'])
    expect(validateStory({ title: 'Priča', typeId: TYPE }).issues).toEqual([])
    const published = validateStory({ title: 'Priča', typeId: TYPE, status: 'published' })
    expect(paths(published.issues)).toEqual(['textLocal'])
    // Either text is enough.
    expect(validateStory({ title: 'Priča', typeId: TYPE, status: 'published', textStandard: 'Prepričano.' }).issues).toEqual([])
  })

  it('never blocks publishing on verification: an Unverified Story with no narrator or source publishes', () => {
    expect(validateStory(story({ status: 'published', verification: 'unverified' })).issues).toEqual([])
  })

  it('lets Verified stand only on a narrator (named or described) or a source', () => {
    expect(paths(validateStory(story({ verification: 'verified' })).issues)).toEqual(['verification'])
    // A collector alone does not vouch that it was told here.
    const collector = [{ role: 'collector', description: 'zapisao Karlo' }]
    expect(paths(validateStory(story({ verification: 'verified', people: collector })).issues)).toEqual(['verification'])
    const narrator = [{ role: 'narrator', description: 'kazivačica, r. 1938., Gornji Fodrovec' }]
    expect(validateStory(story({ verification: 'verified', people: narrator })).issues).toEqual([])
    expect(validateStory(story({ verification: 'verified', sourceIds: [SOURCE] })).issues).toEqual([])
    expect(validateStory(story({ verification: 'needs_update' })).issues).toEqual([])
    expect(paths(validateStory(story({ verification: 'checked' })).issues)).toEqual(['verification'])
  })

  it('refuses a malformed slug and type', () => {
    expect(paths(validateStory(story({ slug: 'Loš Slug' })).issues)).toEqual(['slug'])
    expect(paths(validateStory(story({ typeId: 'bajka' })).issues)).toEqual(['typeId'])
    expect(paths(validateStory(story({ title: 'x'.repeat(INTANGIBLE_LIMITS.title + 1) })).issues)).toContain('title')
    expect(paths(validateStory(story({ textLocal: 'x'.repeat(INTANGIBLE_LIMITS.text + 1) })).issues)).toEqual(['textLocal'])
  })

  it('keeps the places, themes, sources and heritage items in order, once each', () => {
    const { value, issues } = validateStory(story({
      areaLinks: [
        { areaId: AREA, relation: 'recorded_in' },
        { areaId: AREA, relation: 'about' },
        { areaId: AREA.toUpperCase(), relation: 'recorded_in' }
      ],
      itemIds: [SOURCE, TYPE, SOURCE],
      themeIds: [TYPE],
      sourceIds: [SOURCE, AREA]
    }))
    expect(issues).toEqual([])
    expect(value.areaLinks).toEqual([{ areaId: AREA, relation: 'recorded_in' }, { areaId: AREA, relation: 'about' }])
    expect(value.itemIds).toEqual([SOURCE, TYPE])
    expect(value.sourceIds).toEqual([SOURCE, AREA])
    const bad = validateStory(story({ areaLinks: [{ areaId: 'x', relation: 'near' }, 'x'], itemIds: ['x'], sourceIds: 'x' }))
    expect(paths(bad.issues)).toEqual(['areaLinks.0.areaId', 'areaLinks.0.relation', 'areaLinks.1', 'itemIds.0', 'sourceIds'])
  })
})

describe('people links: narrator, collector, author and consent', () => {
  const people = (rows: unknown) => validateStory(story({ people: rows }))

  it('names a living narrator only with recorded consent, and otherwise needs the public description', () => {
    const { value, issues } = people([
      { role: 'narrator', personId: null, description: 'kazivačica, r. 1938., Gornji Fodrovec' },
      { role: 'narrator', personId: PERSON, consentNamed: true, consentNote: 'usmeno, 8. 11. 2026.' },
      { role: 'collector', personId: null, description: 'zapisao Karlo Siladi' },
      { role: 'author', personId: PERSON }
    ])
    expect(issues).toEqual([])
    expect(value.people).toEqual([
      { role: 'narrator', personId: null, consentNamed: false, consentNote: null, description: 'kazivačica, r. 1938., Gornji Fodrovec' },
      { role: 'narrator', personId: PERSON, consentNamed: true, consentNote: 'usmeno, 8. 11. 2026.', description: null },
      { role: 'collector', personId: null, consentNamed: false, consentNote: null, description: 'zapisao Karlo Siladi' },
      { role: 'author', personId: PERSON, consentNamed: false, consentNote: null, description: null }
    ])
  })

  it('refuses a narrator who is neither named with consent nor described, and consent without a person', () => {
    expect(paths(people([{ role: 'narrator', personId: PERSON }]).issues)).toEqual(['people.0.description'])
    expect(paths(people([{ role: 'narrator', personId: PERSON, consentNamed: false }]).issues)).toEqual(['people.0.description'])
    expect(paths(people([{ role: 'narrator' }]).issues)).toEqual(['people.0.description', 'people.0.description'])
    expect(paths(people([{ role: 'narrator', consentNamed: true, description: 'x' }]).issues)).toEqual(['people.0.consentNamed'])
    expect(paths(people([{ role: 'editor', description: 'x' }]).issues)).toEqual(['people.0.role'])
    expect(paths(people([{ role: 'collector', personId: 'x' }]).issues)).toContain('people.0.personId')
    expect(paths(people('x').issues)).toEqual(['people'])
  })

  it('keeps one link per person and role', () => {
    const { value } = people([
      { role: 'narrator', personId: PERSON, consentNamed: true },
      { role: 'narrator', personId: PERSON, consentNamed: true },
      { role: 'collector', personId: PERSON }
    ])
    expect(value.people.map(link => link.role)).toEqual(['narrator', 'collector'])
  })
})

describe('Recorded on keeps to what is known', () => {
  const parse = (body: Record<string, unknown>) => {
    const issues: Array<{ path: string, message: string }> = []
    const value = parseRecordedOn((path, message) => issues.push({ path, message }), body)
    return { value, paths: paths(issues) }
  }

  it('accepts no date, a year, a month and a day, each with only the parts it is precise to', () => {
    expect(parse({})).toEqual({ value: { recordedPrecision: null, recordedYear: null, recordedMonth: null, recordedDay: null }, paths: [] })
    expect(parse({ recordedPrecision: 'year', recordedYear: 1962 }).value).toEqual({ recordedPrecision: 'year', recordedYear: 1962, recordedMonth: null, recordedDay: null })
    expect(parse({ recordedPrecision: 'month', recordedYear: 2026, recordedMonth: 11 }).value).toEqual({ recordedPrecision: 'month', recordedYear: 2026, recordedMonth: 11, recordedDay: null })
    expect(parse({ recordedPrecision: 'day', recordedYear: 2024, recordedMonth: 2, recordedDay: 29 }).paths).toEqual([])
  })

  it('never fills in or accepts a part below the precision, and refuses days that do not exist', () => {
    expect(parse({ recordedYear: 2026 }).paths).toEqual(['recordedPrecision'])
    expect(parse({ recordedPrecision: 'year' }).paths).toEqual(['recordedYear'])
    expect(parse({ recordedPrecision: 'year', recordedYear: 1962, recordedMonth: 5 }).paths).toEqual(['recordedMonth'])
    expect(parse({ recordedPrecision: 'month', recordedYear: 1962, recordedMonth: 5, recordedDay: 3 }).paths).toEqual(['recordedDay'])
    expect(parse({ recordedPrecision: 'month', recordedYear: 1962 }).paths).toEqual(['recordedMonth'])
    expect(parse({ recordedPrecision: 'day', recordedYear: 1962, recordedMonth: 5 }).paths).toEqual(['recordedDay'])
    expect(parse({ recordedPrecision: 'day', recordedYear: 2026, recordedMonth: 2, recordedDay: 29 }).paths).toEqual(['recordedDay'])
    expect(parse({ recordedPrecision: 'day', recordedYear: 2026, recordedMonth: 4, recordedDay: 31 }).paths).toEqual(['recordedDay'])
    expect(parse({ recordedPrecision: 'decade', recordedYear: 1960 }).paths).toEqual(['recordedPrecision'])
    expect(parse({ recordedPrecision: 'year', recordedYear: 999 }).paths).toEqual(['recordedYear', 'recordedYear'])
    expect(parse({ recordedPrecision: 'month', recordedYear: 2026, recordedMonth: 13 }).paths).toContain('recordedMonth')
  })
})

describe('Set in and Practised periods', () => {
  it('keeps the words people use with an optional approximate decade or century', () => {
    const decade = validateStory(story({ period: ' do 1960-ih ', periodUnit: 'decade', periodValue: 1960 }))
    expect(decade.issues).toEqual([])
    expect(decade.value).toMatchObject({ period: 'do 1960-ih', periodUnit: 'decade', periodValue: 1960 })
    const century = validateStory(story({ period: 'u turska vremena', periodUnit: 'century', periodValue: 16 }))
    expect(century.value).toMatchObject({ periodUnit: 'century', periodValue: 16 })
    // The words alone are enough, and the approximation alone too.
    expect(validateStory(story({ period: 'u stara vremena' })).issues).toEqual([])
    expect(validateStory(story({ periodUnit: 'century', periodValue: 17 })).issues).toEqual([])
  })

  it('refuses a half-given or impossible approximation', () => {
    expect(paths(validateStory(story({ periodUnit: 'decade' })).issues)).toEqual(['periodValue'])
    expect(paths(validateStory(story({ periodValue: 1960 })).issues)).toEqual(['periodUnit'])
    expect(paths(validateStory(story({ periodUnit: 'decade', periodValue: 1965 })).issues)).toEqual(['periodValue'])
    expect(paths(validateStory(story({ periodUnit: 'century', periodValue: 22 })).issues)).toEqual(['periodValue'])
    expect(paths(validateStory(story({ periodUnit: 'era', periodValue: 3 })).issues)).toEqual(['periodUnit'])
  })
})

describe('validateCustom', () => {
  const custom = (extra: Record<string, unknown> = {}) => ({ title: 'Martinje u Kalniku', typeId: TYPE, description: 'Na Martinje se krstio mošt.', ...extra })

  it('has an optional occasion, a description needed only to publish, and ordered quotes', () => {
    const { value, issues } = validateCustom(custom({ occasionId: AREA, quotes: ['  Mošt se krsti!  ', '', 'Vino je gospodin.'], period: 'do 1960-ih' }))
    expect(issues).toEqual([])
    expect(value).toMatchObject({ slug: 'martinje-u-kalniku', occasionId: AREA, quotes: ['Mošt se krsti!', 'Vino je gospodin.'], period: 'do 1960-ih' })
    expect(validateCustom(custom()).value.occasionId).toBeNull()
    expect(validateCustom({ title: 'Običaj', typeId: TYPE }).issues).toEqual([])
    expect(paths(validateCustom({ title: 'Običaj', typeId: TYPE, status: 'published' }).issues)).toEqual(['description'])
  })

  it('refuses malformed occasions and quotes', () => {
    expect(paths(validateCustom(custom({ occasionId: 'martinje' })).issues)).toEqual(['occasionId'])
    expect(paths(validateCustom(custom({ quotes: 'x' })).issues)).toEqual(['quotes'])
    expect(paths(validateCustom(custom({ quotes: Array.from({ length: 11 }, () => 'q') })).issues)).toEqual(['quotes'])
    expect(paths(validateCustom(custom({ quotes: ['x'.repeat(INTANGIBLE_LIMITS.quote + 1)] })).issues)).toEqual(['quotes.0'])
  })
})

describe('validateFolkText', () => {
  const folk = (extra: Record<string, unknown> = {}) => ({ title: 'Zdravica na Martinje', typeId: TYPE, textLocal: 'Zdravi bili!', ...extra })

  it('links to the Custom it belonged to and to the Words it contains', () => {
    const { value, issues } = validateFolkText(folk({ customId: AREA, wordIds: ['hiza', 'kaj', 'hiza'] }))
    expect(issues).toEqual([])
    expect(value).toMatchObject({ customId: AREA, wordIds: ['hiza', 'kaj'], textLocal: 'Zdravi bili!' })
    expect(validateFolkText(folk()).value).toMatchObject({ customId: null, wordIds: [] })
  })

  it('needs a text to publish, and valid links', () => {
    expect(paths(validateFolkText({ title: 'Brojalica', typeId: TYPE, status: 'published' }).issues)).toEqual(['textLocal'])
    expect(paths(validateFolkText(folk({ customId: 'obicaj' })).issues)).toEqual(['customId'])
    expect(paths(validateFolkText(folk({ wordIds: ['', 5] })).issues)).toEqual(['wordIds.0', 'wordIds.1'])
    expect(paths(validateFolkText(folk({ wordIds: 'hiza' })).issues)).toEqual(['wordIds'])
  })
})

describe('type, occasion and theme lists', () => {
  it('validate like heritage categories: a key, Croatian and English labels, a sort order', () => {
    for (const validate of [validateStoryType, validateCustomType, validateFolkTextType, validateOccasion]) {
      const { value, issues } = validate({ key: 'saljiva-prica', labelHr: ' šaljiva priča ', labelEn: '', sort: 40 })
      expect(issues).toEqual([])
      expect(value).toEqual({ key: 'saljiva-prica', labelHr: 'šaljiva priča', labelEn: null, sort: 40, status: 'published' })
      expect(paths(validate({ key: 'Loš Ključ', labelHr: '' }).issues)).toEqual(['key', 'labelHr'])
      expect(paths(validate({ key: 'k', labelHr: 'k', sort: 'prvi' }).issues)).toEqual(['sort'])
    }
    expect(validateStoryType(null).issues[0]).toEqual({ path: '', message: 'Podaci vrste priče nedostaju.' })
  })

  it('give a theme a slug from its Croatian label and a description', () => {
    const { value, issues } = validateTheme({ labelHr: 'Vino i vinogradi', description: 'Sve o vinu.' })
    expect(issues).toEqual([])
    expect(value).toEqual({ slug: 'vino-i-vinogradi', labelHr: 'Vino i vinogradi', labelEn: null, description: 'Sve o vinu.', sort: 0, status: 'published' })
    expect(paths(validateTheme({ labelHr: 'Kalnik', slug: 'Loš Slug' }).issues)).toEqual(['slug'])
    expect(paths(validateTheme({}).issues)).toEqual(['labelHr', 'slug'])
  })
})

describe('registration in the shared content layer', () => {
  const kinds = ['story', 'custom', 'folk_text', 'story_type', 'custom_type', 'folk_text_type', 'occasion', 'theme']

  it('knows every kind, for the admin API and the history', () => {
    for (const kind of kinds) {
      expect(isContentKind(kind), kind).toBe(true)
      expect(HISTORY_KINDS as readonly string[], kind).toContain(kind)
      expect(HISTORY_KIND_META[kind as keyof typeof HISTORY_KIND_META].singular, kind).toBeTruthy()
    }
  })

  it('labels every field of a record in the history, links included', () => {
    for (const kind of ['story', 'custom', 'folk_text'] as const) {
      const fields = Object.keys(HISTORY_FIELDS[kind])
      expect(fields, kind).toEqual(expect.arrayContaining([
        'title', 'slug', 'typeId', 'recordedPrecision', 'recordedYear', 'verification', 'areaLinks', 'people', 'itemIds', 'themeIds', 'sourceIds'
      ]))
    }
    expect(Object.keys(HISTORY_FIELDS.custom)).toEqual(expect.arrayContaining(['occasionId', 'description', 'quotes', 'period']))
    expect(Object.keys(HISTORY_FIELDS.folk_text)).toEqual(expect.arrayContaining(['customId', 'wordIds', 'textLocal']))
  })
})
