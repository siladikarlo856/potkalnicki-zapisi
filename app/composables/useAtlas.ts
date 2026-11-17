export function useAtlas() {
  const localePath = useLocalePath()

  function settlementPath(slug: string) {
    return localePath(`/naselja/${slug}`)
  }

  function municipalityPath(slug: string) {
    return localePath(`/istrazi/${slug}`)
  }

  function itemPath(settlementSlug: string, itemSlug: string) {
    return localePath(`/bastina/${settlementSlug}/${itemSlug}`)
  }

  return { settlementPath, municipalityPath, itemPath }
}
