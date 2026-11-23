/** Variant row used only for place-aware ordering in word reveal. */
export interface VariantPlaceOrderInput {
  id: string
  usages: { areaId: string }[]
}

export type VariantPlaceOrderState = 'no-preference' | 'matched' | 'no-match'

export interface VariantPlaceOrderResult<T extends VariantPlaceOrderInput> {
  ordered: T[]
  state: VariantPlaceOrderState
  /** Set when a matching variant was moved ahead of the base form. */
  preferredId?: string
}

function stableMatchIndex<T extends VariantPlaceOrderInput>(variants: T[], placeAreaId: string): number | undefined {
  const indices = variants
    .map((variant, index) => ({ variant, index }))
    .filter(({ variant }) => variant.usages.some(usage => usage.areaId === placeAreaId))
    .sort((a, b) => (a.index !== b.index ? a.index - b.index : a.variant.id.localeCompare(b.variant.id)))
  return indices[0]?.index
}

/** Reorder variants for word reveal: matching Usage first, otherwise keep editor order. */
export function orderVariantsForPlace<T extends VariantPlaceOrderInput>(
  variants: T[],
  placeAreaId?: string
): VariantPlaceOrderResult<T> {
  if (!placeAreaId || !variants.length) {
    return { ordered: variants, state: 'no-preference' }
  }
  const matchIndex = stableMatchIndex(variants, placeAreaId)
  if (matchIndex === undefined) {
    return { ordered: variants, state: 'no-match' }
  }
  if (matchIndex === 0) {
    return { ordered: variants, state: 'matched', preferredId: variants[0]!.id }
  }
  const preferred = variants[matchIndex]!
  const rest = variants.filter((_, index) => index !== matchIndex)
  return { ordered: [preferred, ...rest], state: 'matched', preferredId: preferred.id }
}
