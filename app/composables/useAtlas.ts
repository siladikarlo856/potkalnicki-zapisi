export function useAtlas() {
  const localePath = useLocalePath()

  function settlementPath(slug: string) {
    return localePath(`/potkalnicko-prigorje/naselja/${slug}`)
  }

  function municipalityPath(slug: string) {
    return localePath(`/potkalnicko-prigorje/istrazi/${slug}`)
  }

  function itemPath(settlementSlug: string, itemSlug: string) {
    return localePath(`/potkalnicko-prigorje/bastina/${settlementSlug}/${itemSlug}`)
  }

  return { settlementPath, municipalityPath, itemPath }
}
