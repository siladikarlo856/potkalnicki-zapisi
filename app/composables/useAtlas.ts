import { municipalityPagePath, pzPath, pzRoutes, settlementPagePath } from '~~/shared/utils/appRoutes'

export function useAtlas() {
  const localePath = useLocalePath()

  /** A settlement page hangs off its municipality: /mjesta/[opcina]/[naselje]/. */
  function settlementPath(municipalitySlug: string, slug: string) {
    return localePath(settlementPagePath(municipalitySlug, slug))
  }

  function municipalityPath(slug: string) {
    return localePath(municipalityPagePath(slug))
  }

  function itemPath(settlementSlug: string, itemSlug: string) {
    return localePath(pzPath(pzRoutes.heritage, settlementSlug, itemSlug))
  }

  return { settlementPath, municipalityPath, itemPath }
}
