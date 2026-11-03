import { describe, expect, it } from 'vitest'
import { validateArea } from '../shared/utils/content/area'

describe('validateArea', () => {
  it('requires a name and a parent for settlements', () => {
    const { issues } = validateArea({ kind: 'settlement', name: '  ', parentId: null, regionIds: [] })
    expect(issues.map(issue => issue.path)).toEqual(expect.arrayContaining(['name', 'parentId']))
  })

  it('requires a slug when publishing a settlement', () => {
    const { issues } = validateArea({
      kind: 'settlement',
      name: 'Apatovec',
      parentId: '92140ed6-6420-81d0-8661-91ce0c257f5f',
      status: 'published',
      slug: null,
      regionIds: []
    })
    expect(issues).toEqual([{ path: 'slug', message: 'Objavljeno mjesto ove vrste mora imati slug.' }])
  })

  it('rejects region membership on a country', () => {
    const { issues } = validateArea({
      kind: 'country',
      name: 'Hrvatska',
      regionIds: ['85e561aa-2656-8fe2-9fa5-21ea34ff409e']
    })
    expect(issues).toEqual([{ path: 'regionIds', message: 'Ova vrsta mjesta ne može pripadati regiji.' }])
  })

  it('normalizes optional geonames and coordinates as a pair', () => {
    const { value, issues } = validateArea({
      kind: 'town',
      name: 'Križevci',
      parentId: '7008fb08-7895-8680-9320-7effc445e712',
      slug: 'grad-krizevci',
      geonamesId: ' 3197230 ',
      latitude: 46.02,
      longitude: null,
      regionIds: []
    })
    expect(issues.map(issue => issue.path)).toEqual(expect.arrayContaining(['longitude']))
    expect(value.geonamesId).toBe('3197230')
  })
})
