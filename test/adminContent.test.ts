import { describe, expect, it } from 'vitest'
import { contentFold, isContentKind, isUuid } from '../shared/utils/content/common'
import { validateHeritageCategory } from '../shared/utils/content/category'
import { validateHeritageItem } from '../shared/utils/content/heritageItem'
import { validatePerson } from '../shared/utils/content/person'
import { SOURCE_LIMITS, SOURCE_TYPES, SOURCE_TYPE_LABELS, validateSource } from '../shared/utils/content/source'
import { adminRouteScope } from '../server/utils/requestGuard'
import sources from './fixtures/atlas/sources.json'

describe('validateSource (shared by the dialog and the API)', () => {
  it('accepts every source in the atlas content and projects known fields only', () => {
    for (const source of sources) {
      const { value, issues } = validateSource({ ...source, id: 'ignored', revision: 9, extra: true })
      expect(issues, source.id).toEqual([])
      expect(value).toEqual({ title: source.title, type: source.type, url: source.url, note: null, status: 'published' })
    }
  })

  it('trims text, turns empty optional fields into null and keeps a given status', () => {
    expect(validateSource({ title: '  Rječnik  ', type: 'dictionary', url: '', note: '  ', status: 'draft' }).value)
      .toEqual({ title: 'Rječnik', type: 'dictionary', url: null, note: null, status: 'draft' })
  })

  it('reports each problem on its field, in Croatian', () => {
    const { issues } = validateSource({ title: ' ', type: 'poem', url: 'ftp://x', note: 'n'.repeat(SOURCE_LIMITS.note + 1), status: 'deleted' })
    expect(issues).toEqual([
      { path: 'title', message: 'Polje „Naslov“ je obavezno.' },
      { path: 'type', message: 'Vrijednost polja „Vrsta“ nije dopuštena.' },
      { path: 'url', message: 'Polje „Poveznica“ mora počinjati s http:// ili https:// i ne smije sadržavati razmake.' },
      { path: 'note', message: `Polje „Napomena“ može imati najviše ${SOURCE_LIMITS.note} znakova.` },
      { path: 'status', message: 'Vrijednost polja „Status“ nije dopuštena.' }
    ])
    expect(validateSource({ title: 'x'.repeat(SOURCE_LIMITS.title + 1), type: 'website', url: 'https://a b' }).issues.map(issue => issue.path))
      .toEqual(['title', 'url'])
    expect(validateSource({ title: 5, type: 'website' }).issues).toEqual([{ path: 'title', message: 'Polje „Naslov“ mora biti tekst.' }])
    expect(validateSource(null).issues.map(issue => issue.path)).toEqual(['', 'title', 'type'])
  })

  it('labels every source type', () => {
    expect(Object.keys(SOURCE_TYPE_LABELS).sort()).toEqual([...SOURCE_TYPES].sort())
  })
})

describe('content helpers', () => {
  it('folds accents like the database content_fold', () => {
    expect(contentFold('Čakovec Ćuk Đurđevac Šibenik Žabno čćđšž')).toBe('cakovec cuk durdevac sibenik zabno ccdsz')
  })

  it('recognizes UUIDs and registered kinds', () => {
    expect(isUuid('6F1C1C36-3A5E-4B7F-9A52-0D3F0B6C1A10')).toBe(true)
    expect(isUuid('registar-kulturnih-dobara')).toBe(false)
    expect(isContentKind('source')).toBe(true)
    expect(isContentKind('heritage_item')).toBe(true)
    expect(isContentKind('person')).toBe(true)
    expect(isContentKind('sources')).toBe(false)
  })
})

describe('validateHeritageCategory', () => {
  it('requires key and Croatian label', () => {
    const { issues } = validateHeritageCategory({ key: 'Bad Key', labelHr: 'Kapela' })
    expect(issues.some(issue => issue.path === 'key')).toBe(true)
  })
})

describe('validateHeritageItem', () => {
  it('derives slug from name when omitted', () => {
    const { value, issues } = validateHeritageItem({
      name: 'Crkva sv. Ane',
      categoryId: 'cb2f662f-3359-8378-b5f3-448d25991ec6',
      municipalityId: '92140ed6-6420-81d0-8661-91ce0c257f5f',
      verification: 'unverified',
      researchNotes: '',
      sourceIds: []
    })
    expect(issues).toEqual([])
    expect(value.slug).toBe('crkva-sv-ane')
  })
})

describe('validatePerson', () => {
  it('requires a source to publish and warns when clue contains the name', () => {
    const { issues: publishIssues } = validatePerson({
      name: 'Ana Anić',
      slug: 'ana-anic',
      died: '1900.',
      diedYear: 1900,
      clue: 'Ana je bila učiteljica',
      sourceIds: [],
      status: 'published'
    })
    expect(publishIssues.some(issue => issue.path === 'sourceIds')).toBe(true)
    expect(publishIssues.some(issue => issue.path === 'clue')).toBe(true)

    const { issues } = validatePerson({
      name: 'Ana Anić',
      slug: 'ana-anic',
      died: '1900.',
      diedYear: 1900,
      clue: 'učiteljica iz Prigorja',
      verification: 'unverified',
      sourceIds: ['6f1c1c36-3a5e-4b7f-9a52-0d3f0b6c1a10'],
      status: 'published'
    })
    expect(issues).toEqual([])
  })
})

describe('admin guard scope', () => {
  it('protects every admin and review path, however it is spelled, except the session route', () => {
    for (const path of ['/api/admin', '/api/admin/content/source', '/api/review/submissions', '/api/review', '//api//admin/content', '/api/%61dmin/lookup/source', '/API/Review/daily', '/api/admin/session/x']) {
      expect(adminRouteScope(path), path).toBe('protected')
    }
    expect(adminRouteScope('/api/admin/session')).toBe('session')
    expect(adminRouteScope('/api/admin/session/')).toBe('session')
    for (const path of ['/api/submissions', '/api/heritage/words', '/api/administrator', '/admin/izvori', '/api/reviewers']) {
      expect(adminRouteScope(path), path).toBeNull()
    }
  })
})
