import type { Area } from '~/types/heritage'
import type { PublicWords } from '~~/shared/utils/word'

/** Fetch on the client even on prerendered pages, so activation never needs a rebuild. */
export function useHeritage() {
  const { data, status, error, refresh } = useFetch<PublicWords>('/api/heritage/words', {
    key: 'active-heritage-words', server: false, default: () => ({ words: [], areas: [] })
  })
  const words = computed(() => data.value.words)
  const areas = computed(() => data.value.areas)
  const areaById = computed(() => new Map(areas.value.map(area => [area.id, area])))
  /** The area followed by its parents, e.g. Križevci › Koprivničko-križevačka županija › Hrvatska. */
  function areaTrail(id: string): Area[] {
    const trail: Area[] = []
    let area = areaById.value.get(id)
    const visited = new Set<string>()
    while (area && !visited.has(area.id)) {
      visited.add(area.id)
      trail.push(area)
      area = area.parentId ? areaById.value.get(area.parentId) : undefined
    }
    return trail
  }

  return { words, areas, areaById, areaTrail, status, error, refresh }
}
