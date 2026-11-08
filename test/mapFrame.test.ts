import { describe, expect, it } from 'vitest'
import { MUNICIPALITY_BOUNDARIES } from '../shared/utils/games/mapBoundaries'
import { distanceKm, distanceScore, MAP_FRAME, project, unproject } from '../shared/utils/games/mapFrame'

describe('mapFrame', () => {
  it('projects frame corners to image corners within 0.5 px', () => {
    const nw = project(MAP_FRAME.north, MAP_FRAME.west)
    const ne = project(MAP_FRAME.north, MAP_FRAME.east)
    const sw = project(MAP_FRAME.south, MAP_FRAME.west)
    const se = project(MAP_FRAME.south, MAP_FRAME.east)
    expect(nw.x).toBeCloseTo(0, 0)
    expect(nw.y).toBeCloseTo(0, 0)
    expect(ne.x).toBeCloseTo(MAP_FRAME.width, 0)
    expect(ne.y).toBeCloseTo(0, 0)
    expect(sw.x).toBeCloseTo(0, 0)
    expect(sw.y).toBeCloseTo(MAP_FRAME.height, 0)
    expect(se.x).toBeCloseTo(MAP_FRAME.width, 0)
    expect(se.y).toBeCloseTo(MAP_FRAME.height, 0)
  })

  it('keeps every municipality boundary inside the frame with a margin', () => {
    const margin = 20
    for (const [slug, { d }] of Object.entries(MUNICIPALITY_BOUNDARIES)) {
      const pts = [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map(m => ({ x: Number(m[1]), y: Number(m[2]) }))
      expect(pts.length, slug).toBeGreaterThan(10)
      for (const { x, y } of pts) {
        expect(x, slug).toBeGreaterThanOrEqual(margin)
        expect(x, slug).toBeLessThanOrEqual(MAP_FRAME.width - margin)
        expect(y, slug).toBeGreaterThanOrEqual(margin)
        expect(y, slug).toBeLessThanOrEqual(MAP_FRAME.height - margin)
      }
    }
  })

  it('round-trips project and unproject', () => {
    const points = [
      { lat: 46.02194, lng: 16.5425 },
      { lat: 46.12059, lng: 16.46437 },
      { lat: 46.11366, lng: 16.48131 }
    ]
    for (const p of points) {
      const { x, y } = project(p.lat, p.lng)
      const back = unproject(x, y)
      expect(back.lat).toBeCloseTo(p.lat, 3)
      expect(back.lng).toBeCloseTo(p.lng, 3)
    }
  })

  it('places Križevci near the handbook check point', () => {
    const { x, y } = project(46.02194, 16.5425)
    expect(x).toBeCloseTo(840.3, 0)
    expect(y).toBeCloseTo(949.1, 0)
  })

  it('measures Šopron to Potok Kalnički at about 1.5 km', () => {
    const km = distanceKm(
      { lat: 46.12059, lng: 16.46437 },
      { lat: 46.11366, lng: 16.48131 }
    )
    expect(km).toBeCloseTo(1.5, 0)
  })

  it('scores distance linearly to zero at 5 km', () => {
    expect(distanceScore(0)).toBe(1000)
    expect(distanceScore(2.5)).toBe(500)
    expect(distanceScore(5)).toBe(0)
    expect(distanceScore(9)).toBe(0)
  })
})
