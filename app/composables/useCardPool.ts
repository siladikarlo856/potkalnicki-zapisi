import type { CardPool, PoolCard, TopicId } from '~~/shared/utils/learn/types'
import { cardMatchesTopicSelection, municipalitySlugMap } from '~~/shared/utils/learn/topics'

const emptyPool = (): CardPool => ({
  version: 1,
  generatedAt: '',
  cards: [],
  municipalities: [],
  settlements: [],
  topics: []
})

/** Client-side card pool for Learn and Play (WP5+). */
export function useCardPool() {
  const { data, status, error, refresh } = useFetch<CardPool>('/api/learn/pool', {
    key: 'card-pool',
    server: false,
    default: () => emptyPool()
  })

  const pool = computed(() => data.value ?? emptyPool())

  const municipalitySlugById = computed(() =>
    municipalitySlugMap(pool.value.municipalities.map(m => ({ id: m.id, slug: m.slug })))
  )

  function cardsFor(topics: MaybeRef<TopicId[]>) {
    return computed(() => {
      const selected = toValue(topics)
      const slugMap = municipalitySlugById.value
      return pool.value.cards.filter((card: PoolCard) =>
        cardMatchesTopicSelection(card, selected, slugMap)
      )
    })
  }

  function topicCount(id: TopicId) {
    return computed(() => pool.value.topics.find(t => t.id === id)?.count ?? 0)
  }

  return { pool, status, error, refresh, cardsFor, topicCount }
}
