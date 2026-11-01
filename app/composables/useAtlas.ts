import {
  categoryLabel,
  getAtlas,
  heritageForSettlement,
  heritageItemByRoute,
  municipalityBySlug,
  municipalityStats,
  settlementByCode,
  settlementBySlug
} from '~~/shared/utils/atlasData'

export function useAtlas() {
  const atlas = useState('pz-atlas', () => getAtlas())
  const { t } = useI18n()
  const localePath = useLocalePath()

  function municipalityName(id: string) {
    return t(`pz.municipalities.${id}`)
  }

  function itemPath(item: { settlementCode: string | null, slug: string }) {
    if (!item.settlementCode) return undefined
    const settlement = settlementByCode(item.settlementCode)
    if (!settlement) return undefined
    return localePath(`/potkalnicko-prigorje/bastina/${settlement.slug}/${item.slug}`)
  }

  function settlementPath(slug: string) {
    return localePath(`/potkalnicko-prigorje/naselja/${slug}`)
  }

  function municipalityPath(slug: string) {
    return localePath(`/potkalnicko-prigorje/istrazi/${slug}`)
  }

  return {
    atlas,
    municipalityName,
    itemPath,
    settlementPath,
    municipalityPath,
    categoryLabel,
    heritageForSettlement,
    municipalityStats,
    municipalityBySlug,
    settlementBySlug,
    settlementByCode,
    heritageItemByRoute
  }
}
