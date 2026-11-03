import { describe, expect, it } from 'vitest'
import type { Area } from '../app/types/heritage'
import { entryAreaIds, projectAreas } from '../server/utils/wordAreas'

const area = (id: string, kind: Area['kind'], parentId: string | null): Area => ({ id, name: id, kind, parentId })
const index = new Map([
  area('country', 'country', null), area('county', 'county', 'country'), area('town', 'town', 'county'),
  area('village-a', 'settlement', 'town'), area('village-b', 'settlement', 'town'),
  area('loop-1', 'settlement', 'loop-2'), area('loop-2', 'settlement', 'loop-1')
].map(a => [a.id, a]))
const usage = (areaId: unknown) => ({ id: 'v', form: 'x', status: 'community', usages: [{ areaId, confidence: 'reported' }] })

describe('the areas of a word, read from the areas table', () => {
  it('collects the ids of usages and examples once each, in order', () => {
    expect(entryAreaIds({ variants: [usage('village-a'), usage('village-b'), usage('village-a')], examples: [{ text: 'x', areaId: 'town' }, { text: 'y' }] }))
      .toEqual(['village-a', 'village-b', 'town'])
  })

  it('returns the referenced areas with their ancestors, parents before children, each once', () => {
    const areas = projectAreas({ variants: [usage('village-a'), usage('village-b')] }, index)
    expect(areas.map(a => a.id)).toEqual(['country', 'county', 'town', 'village-a', 'village-b'])
    expect(areas.find(a => a.id === 'village-a')).toEqual({ id: 'village-a', name: 'village-a', kind: 'settlement', parentId: 'town' })
  })

  it('leaves out ids the table does not know, so the usage fails validation instead of being guessed', () => {
    expect(projectAreas({ variants: [usage('hr-kkz-krizevci'), usage('village-a')] }, index).map(a => a.id)).toEqual(['country', 'county', 'town', 'village-a'])
  })

  it('survives broken entries and parent loops', () => {
    for (const entry of [null, 'text', {}, { variants: 'x' }, { variants: [null, { usages: [{ areaId: 7 }] }] }]) expect(projectAreas(entry, index)).toEqual([])
    expect(projectAreas({ variants: [usage('loop-1')] }, index).map(a => a.id).sort()).toEqual(['loop-1', 'loop-2'])
  })
})
