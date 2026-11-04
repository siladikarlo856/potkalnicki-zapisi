import type { PlaceOption } from '~~/shared/types/place'
import type { CardPool } from '~~/shared/utils/learn/types'

/** Map a contribution place picker row to a settlement slug from the learn pool. */
export function settlementSlugForPlace(pool: CardPool, place: PlaceOption): string | undefined {
  return pool.settlements.find((settlement) => {
    if (settlement.name !== place.name) return false
    const unit = pool.municipalities.find(m => m.id === settlement.municipalityId)
    if (!unit) return false
    return unit.name === place.municipality || unit.label.includes(place.municipality)
  })?.slug
}

export function settlementForSlug(pool: CardPool, slug: string | undefined) {
  if (!slug) return undefined
  return pool.settlements.find(s => s.slug === slug)
}
