import type { AtlasRedirectResponse } from '~~/shared/types/publicAtlas'

function isRedirect(value: unknown): value is AtlasRedirectResponse {
  return typeof value === 'object' && value !== null && 'redirect' in value
}

/** Fetch a public atlas API route during SSR; follow slug-history with 301 and surface HTTP errors. */
export async function useAtlasFetch<T>(path: MaybeRefOrGetter<string>) {
  const localePath = useLocalePath()
  const { data, error } = await useFetch<T | AtlasRedirectResponse>(path)
  if (error.value) {
    throw createError({
      statusCode: error.value.statusCode ?? 500,
      statusMessage: error.value.statusMessage ?? 'Request failed',
      fatal: true
    })
  }
  if (isRedirect(data.value)) {
    await navigateTo(localePath(data.value.redirect), { redirectCode: 301 })
  }
  return { data: data as Ref<T | null> }
}
