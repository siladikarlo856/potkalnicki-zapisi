import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

  it('renders numbered dots for challenge map-points', async () => {
    const page = await mountSuspended(MapView, {
      props: {
        places: [],
        municipalities,
        difficulty: 'srednje',
        mode: 'target',
        numberedPoints: [
          { lat: 46.12, lng: 16.46 },
          { lat: 46.11, lng: 16.47 },
          { lat: 46.10, lng: 16.48 },
          { lat: 46.09, lng: 16.49 }
        ],
        layerLocked: 'karta'
      }
    })
    expect(page.findAll('[data-testid^="map-numbered-"]')).toHaveLength(4)
  })

  describe('default zoom and centring at 390px', () => {
    const VW = 390
    const VH = 335
    const original = {
      w: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
      h: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
    }
    beforeEach(() => {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => VW })
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => VH })
    })
    afterEach(() => {
      if (original.w) Object.defineProperty(HTMLElement.prototype, 'clientWidth', original.w)
      if (original.h) Object.defineProperty(HTMLElement.prototype, 'clientHeight', original.h)
    })

    const view = (page: Awaited<ReturnType<typeof mountSuspended>>) =>
      page.vm as unknown as { scale: number, translate: { x: number, y: number } }

    it('opens modestly zoomed out and never zooms out further', async () => {
      const page = await mountSuspended(MapView, {
        props: { places: [sopron], municipalities, difficulty: 'tesko', mode: 'find' }
      })
      expect(view(page).scale).toBe(0.75)
      await page.get('[data-testid="map-zoom-out"]').trigger('click')
      expect(view(page).scale).toBe(0.75)
    })

    it('centres the marked dot, within the map bounds', async () => {
      const page = await mountSuspended(MapView, {
        props: { places: [sopron], municipalities, difficulty: 'srednje', mode: 'target', singleTarget: true, highlightId: sopron.id }
      })
      const { scale, translate } = view(page)
      const dot = project(sopron.lat, sopron.lng)
      expect(translate.x).toBeLessThanOrEqual(0)
      expect(translate.x).toBeGreaterThanOrEqual(VW - 1600 * scale - 0.5)
      expect(translate.y).toBeLessThanOrEqual(0)
      expect(translate.y).toBeGreaterThanOrEqual(VH - 1373 * scale - 0.5)
      const atEdgeX = translate.x === 0 || Math.abs(translate.x - (VW - 1600 * scale)) < 0.5
      const atEdgeY = translate.y === 0 || Math.abs(translate.y - (VH - 1373 * scale)) < 0.5
      if (!atEdgeX) expect(dot.x * scale + translate.x).toBeCloseTo(VW / 2, 0)
      if (!atEdgeY) expect(dot.y * scale + translate.y).toBeCloseTo(VH / 2, 0)
    })

    it('re-centres when the challenge target changes', async () => {
      const page = await mountSuspended(MapView, {
        props: { places: [], municipalities, difficulty: 'srednje', mode: 'target', layerLocked: 'karta', targetPoint: { lat: 46.0, lng: 16.4 } }
      })
      const first = { ...view(page).translate }
      await page.setProps({ targetPoint: { lat: 46.1, lng: 16.6 } })
      await page.vm.$nextTick()
      const second = view(page).translate
      expect(second.x !== first.x || second.y !== first.y).toBe(true)
    })

    it('keeps a neutral view without a marked dot', async () => {
      const page = await mountSuspended(MapView, {
        props: { places: [sopron], municipalities, difficulty: 'tesko', mode: 'find' }
      })
      const { scale, translate } = view(page)
      expect(scale).toBe(0.75)
      expect(translate.x).toBeCloseTo(0, 5)
    })
  })
})
