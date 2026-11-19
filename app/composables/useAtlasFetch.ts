import type { AtlasRedirectResponse } from '~~/shared/types/publicAtlas'

function isRedirect(value: unknown): value is AtlasRedirectResponse {
  return typeof value === 'object' && value !== null && 'redirect' in value
}

/** Fetch a public atlas API route during SSR; follow slug-history with 301 and surface HTTP errors. */
export async function useAtlasFetch<T>(path: MaybeRefOrGetter<string>) {
  const localePath = useLocalePath()
  const nuxtApp = useNuxtApp()
  const { data, error } = await useFetch<T | AtlasRedirectResponse>(path)
  if (error.value) {
    throw createError({
      statusCode: error.value.statusCode ?? 500,
      statusMessage: error.value.statusMessage ?? 'Request failed',
      fatal: true
    })
  }
  if (isRedirect(data.value)) {
    // The Nuxt context is gone after the await above, and navigateTo needs it (it answered 500 without).
    const target = localePath(data.value.redirect)
    await nuxtApp.runWithContext(() => navigateTo(target, { redirectCode: 301 }))
  }
  return { data: computed(() => isRedirect(data.value) ? null : data.value as T | null) }
}
