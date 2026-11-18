import type { PublicContent } from './publicContent'
import { resolveSettlement } from './publicAtlas'
import { atlasSettlementPath } from './publicRefs'

/**
 * What `/naselja/[naselje]` becomes: 301 to `/mjesta/[opcina]/[naselje]/` (the municipality is looked up; an old
 * slug goes straight to the current address), 410 for a removed settlement, 404 for an unknown one.
 */
export type SettlementAnswer
  = | { status: 'redirect', location: string }
    | { status: 'gone' }
    | { status: 'not_found' }

export function settlementAnswer(content: PublicContent, slug: string): SettlementAnswer {
  const result = resolveSettlement(content, slug)
  if (result.status === 'ok') return { status: 'redirect', location: atlasSettlementPath(content, result.value) }
  if (result.status === 'redirect') return { status: 'redirect', location: result.path }
  return { status: result.status }
}
