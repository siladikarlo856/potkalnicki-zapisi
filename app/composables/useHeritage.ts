import type { Area, WordEntry } from '~/types/heritage'
import areasData from '~~/content/heritage/areas.json'
import wordsData from '~~/content/heritage/words.json'

const areas = areasData as Area[]
const words = wordsData as WordEntry[]
const areaById = new Map(areas.map(area => [area.id, area]))

/** Static heritage data: word entries with their regional variants, and the area hierarchy. */
export function useHeritage() {
  /** The area followed by its parents, e.g. Križevci › Koprivničko-križevačka županija › Hrvatska. */
  function areaTrail(id: string): Area[] {
    const trail: Area[] = []
    let area = areaById.get(id)
    while (area) {
      trail.push(area)
      area = area.parentId ? areaById.get(area.parentId) : undefined
    }
    return trail
  }

  return { words, areas, areaById, areaTrail }
}
