import { pzRoutes } from '~~/shared/utils/appRoutes'
import { suggestQuery } from '~~/shared/utils/suggest'

/** The three invitations a thin page offers (a word, a memory, a heritage item), as links into /doprinesi. */
export function usePzContributeTypes(prefill: MaybeRefOrGetter<{ settlement?: string, municipality?: string }> = {}) {
  const { t } = useI18n()
  const localePath = useLocalePath()
  return computed(() => {
    const place = toValue(prefill)
    return [
      { label: t('pz.explore.contributeWord'), to: localePath({ path: pzRoutes.contribute, query: { vrsta: 'rijec' } }), icon: 'i-lucide-book-open' },
      { label: t('pz.explore.contributeMemory'), to: localePath({ path: pzRoutes.contribute, query: { vrsta: 'sjecanje' } }), icon: 'i-lucide-message-circle' },
      {
        label: t('pz.explore.contributeHeritage'),
        to: localePath({ path: pzRoutes.contribute, query: suggestQuery('proposal', 'heritage_item', { ...(place.settlement ? { naselje: place.settlement } : {}), ...(place.municipality ? { opcina: place.municipality } : {}) }) }),
        icon: 'i-lucide-church'
      }
    ]
  })
}
