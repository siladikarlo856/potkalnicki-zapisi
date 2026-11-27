import { describe, expect, it } from 'vitest'
import { clampLabelX, placeLabels, type LabelCandidate } from '../shared/utils/games/mapLabels'

const label = (key: string, x: number, y: number, priority = 0, text = key): LabelCandidate => ({ key, x, y, text, priority })

describe('placeLabels', () => {
  it('keeps every label when they are far apart', () => {
    const shown = placeLabels([label('Kalnik', 0, 0), label('Orehovec', 1000, 1000)], 1)
    expect([...shown].sort()).toEqual(['Kalnik', 'Orehovec'])
  })

  it('drops the lower-priority label of a colliding pair', () => {
    const shown = placeLabels([label('Kalnik', 100, 100, 1), label('Orehovec', 105, 102, 5)], 1)
    expect([...shown]).toEqual(['Orehovec'])
  })

  it('breaks priority ties by input order', () => {
    const shown = placeLabels([label('A', 100, 100), label('B', 101, 100)], 1)
    expect([...shown]).toEqual(['A'])
  })

  it('shows more labels as the map is zoomed in', () => {
    const candidates = [label('Gornja Rijeka', 100, 100, 2), label('Kalnik', 130, 110, 1)]
    expect(placeLabels(candidates, 0.25).size).toBe(1)
    expect(placeLabels(candidates, 4).size).toBe(2)
  })

  it('hides a label that would sit on another place’s dot but not on its own', () => {
    const own = { x: 100, y: 100 }
    const other = { x: 100, y: 100 - 13 / 1 }
    expect(placeLabels([label('A', 100, 100)], 1, [own]).has('A')).toBe(true)
    expect(placeLabels([label('A', 100, 100)], 1, [own, other]).has('A')).toBe(false)
  })

  it('lets a label drawn over dots ignore them while still colliding with other labels', () => {
    const dot = { x: 100, y: 100 - 13 }
    const seat = { ...label('Seat', 100, 100, 1000), overDots: true }
    expect(placeLabels([seat], 1, [dot]).has('Seat')).toBe(true)
    const shown = placeLabels([seat, label('Kalnik', 102, 101, 5)], 1, [dot])
    expect([...shown]).toEqual(['Seat'])
  })
})

describe('clampLabelX', () => {
  const seat = 'Općina Gornja Rijeka'

  it('leaves a label whose anchor is well inside the viewport where it is', () => {
    expect(clampLabelX(500, 'Kalnik', 1, 0, 1000)).toBe(500)
    expect(clampLabelX(100, 'Kalnik', 2, 300, 1000)).toBe(100)
  })

  it('shifts a label near the left edge right, and less the further in its anchor is', () => {
    const near = clampLabelX(2, seat, 1, 0, 400)
    const further = clampLabelX(20, seat, 1, 0, 400)
    expect(near).toBeGreaterThan(2)
    expect(further).toBeGreaterThan(20)
    expect(further - 20).toBeLessThan(near - 2)
  })

  it('shifts a label near the right edge left', () => {
    expect(clampLabelX(398, seat, 1, 0, 400)).toBeLessThan(398)
  })

  it('works in frame units when the map is zoomed and panned', () => {
    const unzoomed = clampLabelX(20, seat, 1, 0, 400)
    expect(clampLabelX(10, seat, 2, 0, 400) * 2).toBeCloseTo(unzoomed)
    expect(clampLabelX(60, seat, 2, -100, 400) * 2 - 100).toBeCloseTo(unzoomed)
  })

  it('leaves a label whose anchor is off-screen to be clipped', () => {
    expect(clampLabelX(-500, seat, 1, 0, 400)).toBe(-500)
    expect(clampLabelX(900, seat, 1, 0, 400)).toBe(900)
    expect(clampLabelX(10, seat, 4, -200, 400)).toBe(10)
  })
})
