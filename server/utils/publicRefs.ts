import type {
  PublicMunicipalityRef,
  PublicPersonRef,
  PublicSettlementRef
} from '#shared/types/publicAtlas'
import { municipalityPagePath, pzPath, pzRoutes, settlementPagePath } from '#shared/utils/appRoutes'
import type { PublicContent, SnapshotItem, SnapshotMunicipality, SnapshotPerson, SnapshotSettlement } from './publicContent'

// The paths and the small references (place, person) that the public queries share, kept apart so publicAtlas.ts
// and publicIntangible.ts can both use them without importing each other.

export const atlasMunicipalityPath = municipalityPagePath
/** A settlement page hangs off its municipality: /mjesta/[opcina]/[naselje]/. */
export function atlasSettlementPath(content: PublicContent, settlement: SnapshotSettlement) {
  const municipality = content.municipalityById.get(settlement.municipalityId)
  return municipality ? settlementPagePath(municipality.slug, settlement.slug) : pzRoutes.places
}
export const atlasPersonPath = (slug: string) => pzPath(pzRoutes.persons, slug)
export const atlasItemPath = (settlementSlug: string, slug: string) => pzPath(pzRoutes.heritage, settlementSlug, slug)

export function heritageItemPath(content: PublicContent, item: SnapshotItem) {
  const settlement = item.settlementId ? content.settlementById.get(item.settlementId) : undefined
  return settlement ? atlasItemPath(settlement.slug, item.slug) : null
}

export function municipalityRef(m: SnapshotMunicipality): PublicMunicipalityRef {
  return { id: m.id, slug: m.slug, name: m.name, label: m.label, kind: m.kind, path: atlasMunicipalityPath(m.slug) }
}

export function settlementRef(content: PublicContent, s: SnapshotSettlement): PublicSettlementRef {
  return { id: s.id, slug: s.slug, name: s.name, code: s.code, path: atlasSettlementPath(content, s) }
}

const personYears = (p: SnapshotPerson) => (p.bornYear ? `${p.bornYear}–${p.diedYear}` : String(p.diedYear))

export function personRef(p: SnapshotPerson): PublicPersonRef {
  return { id: p.id, slug: p.slug, name: p.name, years: personYears(p), role: p.role, path: atlasPersonPath(p.slug) }
}

export function personRefs(content: PublicContent, ids: readonly string[]) {
  return ids.flatMap((id) => {
    const person = content.personById.get(id)
    return person ? [personRef(person)] : []
  })
}
