import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MapView from '../app/components/games/MapView.vue'
import { project } from '../shared/utils/games/mapFrame'
import type { PoolMunicipality, PoolPlace } from '../shared/utils/learn/types'

const municipalities: PoolMunicipality[] = [{
  id: 'kalnik',
  slug: 'kalnik',
  name: 'Općina Kalnik',
  label: 'Općina Kalnik',
  dative: 'Općini Kalnik',
  lat: 46.12059,
  lng: 16.46437
}]

const sopron: PoolPlace = {
  kind: 'place',
  key: 'place:063835',
  id: '063835',
  topics: ['mjesta'],
  name: 'Šopron',
  slug: 'sopron',
  municipalityId: 'kalnik',
  lat: 46.12059,
  lng: 16.46437,
  itemCount: 0,
  seat: false,
  difficulty: 2
}

describe('GamesMapView', () => {
  it('scores a list pick as tapping the target dot', async () => {
    const page = await mountSuspended(MapView, {
      props: {
        places: [sopron],
        municipalities,
        difficulty: 'srednje',
        mode: 'find'
      }
    })
    await page.get('[data-testid="map-list-063835"]').trigger('click')
    expect(page.emitted('pick')).toHaveLength(1)
    const pick = page.emitted('pick')![0]![0] as { placeId?: string, imageX: number, imageY: number }
    expect(pick.placeId).toBe('063835')
    const target = project(sopron.lat, sopron.lng)
    expect(pick.imageX).toBeCloseTo(target.x, 0)
    expect(pick.imageY).toBeCloseTo(target.y, 0)
  })
})
