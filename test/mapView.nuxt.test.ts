import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MapView from '../app/components/games/MapView.vue'
import { MAP_FRAME, project } from '../shared/utils/games/mapFrame'
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

  describe.each([
    { name: '390px', vw: 390, vh: 335 },
    { name: '1280px', vw: 1280, vh: 1098 }
  ])('view at $name', ({ vw: VW, vh: VH }) => {
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

    type View = { scale: number, translate: { x: number, y: number } }
    const view = (page: Awaited<ReturnType<typeof mountSuspended>>) => page.vm as unknown as View
    const visible = (v: View, point: { x: number, y: number }) => {
      const x = point.x * v.scale + v.translate.x
      const y = point.y * v.scale + v.translate.y
      return x >= 0 && x <= VW && y >= 0 && y <= VH
    }
    const fit = Math.min(VW / MAP_FRAME.width, VH / MAP_FRAME.height)

    it('opens on the whole area and never zooms out further', async () => {
      const page = await mountSuspended(MapView, {
        props: { places: [sopron], municipalities, difficulty: 'tesko', mode: 'find' }
      })
      const v = view(page)
      expect(v.scale).toBeCloseTo(fit, 5)
      // all four corners of the frame are on screen
      for (const corner of [{ x: 0, y: 0 }, { x: MAP_FRAME.width, y: 0 }, { x: 0, y: MAP_FRAME.height }, { x: MAP_FRAME.width, y: MAP_FRAME.height }]) {
        expect(visible(v, corner)).toBe(true)
      }
      await page.get('[data-testid="map-zoom-out"]').trigger('click')
      expect(view(page).scale).toBeCloseTo(fit, 5)
      await page.get('[data-testid="map-zoom-in"]').trigger('click')
      expect(view(page).scale).toBeGreaterThan(fit)
    })

    it('stays on the whole area when a question marks a dot', async () => {
      const page = await mountSuspended(MapView, {
        props: { places: [sopron], municipalities, difficulty: 'srednje', mode: 'target', singleTarget: true, highlightId: sopron.id }
      })
      const v = view(page)
      expect(v.scale).toBeCloseTo(fit, 5)
      expect(visible(v, project(sopron.lat, sopron.lng))).toBe(true)
    })

    it('returns to the whole area when the challenge target changes', async () => {
      const page = await mountSuspended(MapView, {
        props: { places: [], municipalities, difficulty: 'srednje', mode: 'target', layerLocked: 'karta', targetPoint: { lat: 46.0, lng: 16.4 } }
      })
      await page.get('[data-testid="map-zoom-in"]').trigger('click')
      expect(view(page).scale).toBeGreaterThan(fit)
      await page.setProps({ targetPoint: { lat: 46.1, lng: 16.6 } })
      await page.vm.$nextTick()
      expect(view(page).scale).toBeCloseTo(fit, 5)
    })

    it('shows the pick, the right place and the line after an answer, then resets', async () => {
      const page = await mountSuspended(MapView, {
        props: { places: [sopron], municipalities, difficulty: 'srednje', mode: 'find' }
      })
      const tap = project(46.1, 16.45)
      const target = project(sopron.lat, sopron.lng)
      await page.setProps({ feedback: { tap, target, km: 1.2 }, disabled: true })
      await page.vm.$nextTick()
      const v = view(page)
      expect(v.scale).toBeGreaterThan(fit)
      expect(visible(v, tap)).toBe(true)
      expect(visible(v, target)).toBe(true)
      expect(page.find('[data-testid="map-feedback-line"]').exists()).toBe(true)
      expect(page.text()).toContain('Točno mjesto')
      expect(page.text()).not.toContain('pz.')

      await page.setProps({ feedback: null, disabled: false })
      await page.vm.$nextTick()
      expect(view(page).scale).toBeCloseTo(fit, 5)
    })

    it('keeps surroundings when the pick is far away or almost on the answer', async () => {
      const page = await mountSuspended(MapView, {
        props: { places: [sopron], municipalities, difficulty: 'srednje', mode: 'find' }
      })
      const target = project(sopron.lat, sopron.lng)
      const tap = { x: target.x + 6, y: target.y + 4 }
      await page.setProps({ feedback: { tap, target }, disabled: true })
      await page.vm.$nextTick()
      const v = view(page)
      // at least ~400 frame px of map stay on screen, so the answer is not shown in a void
      expect(VW / v.scale).toBeGreaterThanOrEqual(400 - 0.5)
      expect(visible(v, tap)).toBe(true)
      expect(visible(v, target)).toBe(true)
    })
  })

  describe('municipality boundaries', () => {
    const five = ['grad-krizevci', 'opcina-gornja-rijeka', 'opcina-kalnik', 'opcina-sveti-ivan-zabno', 'opcina-sveti-petar-orehovec']
    const units: PoolMunicipality[] = five.map(slug => ({ ...municipalities[0]!, id: `id-${slug}`, slug }))
    const place = { ...sopron, municipalityId: 'id-opcina-kalnik' }

    it('draws one decorative path per municipality on every layer', async () => {
      const page = await mountSuspended(MapView, {
        props: { places: [place], municipalities: units, difficulty: 'srednje', mode: 'find' }
      })
      for (const layer of ['karta', 'reljef']) {
        await page.get(`[data-testid="map-layer-${layer}"]`).trigger('click')
        const group = page.get('[data-testid="map-boundaries"]')
        expect(group.attributes('aria-hidden')).toBe('true')
        expect(group.classes()).toContain('pointer-events-none')
        const paths = group.findAll('path')
        expect(paths).toHaveLength(5)
        expect(paths.map(p => p.attributes('data-municipality')).sort()).toEqual(five)
        for (const path of paths) expect(path.attributes('d')).toMatch(/^M[-\d. L]+Z$/)
        expect(group.find('[data-highlighted]').exists()).toBe(false)
      }
    })

    it('highlights the municipality a question narrows to', async () => {
      const page = await mountSuspended(MapView, {
        props: { places: [place], municipalities: units, difficulty: 'srednje', mode: 'target', singleTarget: true, highlightId: place.id }
      })
      const highlighted = page.findAll('[data-highlighted]')
      expect(highlighted).toHaveLength(1)
      expect(highlighted[0]!.attributes('data-municipality')).toBe('opcina-kalnik')
    })
  })
})
