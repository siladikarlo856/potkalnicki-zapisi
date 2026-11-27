/** The schematic map of the four areas (a stand-in until real boundaries are loaded). viewBox 0 0 358 210. */
export const MAP_AREAS = [
  { id: 'gornja-rijeka', name: 'Gornja Rijeka', fill: 'var(--pz-map-1)', d: 'M18 62 108 40 124 110 38 122Z', lx: 70, ly: 88 },
  { id: 'kalnik', name: 'Kalnik', fill: 'var(--pz-map-2)', d: 'M108 40 216 32 226 100 124 110Z', lx: 170, ly: 82 },
  { id: 'sveti-petar-orehovec', name: 'Sv. Petar Orehovec', fill: 'var(--pz-map-3)', d: 'M38 122 124 110 226 100 236 150 120 176 50 160Z', lx: 138, ly: 142 },
  { id: 'krizevci', name: 'Križevci', fill: 'var(--pz-map-4)', d: 'M216 32 332 50 346 150 300 196 180 199 120 176 236 150 226 100Z', lx: 278, ly: 124 }
] as const

/** The map area a municipality slug belongs to, if the schematic map knows it. */
export const mapAreaForMunicipality = (slug: string) => MAP_AREAS.find(area => slug.includes(area.id))?.id

// The area map (PzAreaMap) draws the towns and municipalities from their real OSM boundaries, in the games' map frame
// (MAP_FRAME pixels). Fills only tell neighbours apart, so the four map tokens are enough: no two touching areas share
// one. `label` is where the name sits, inside the area; an area missing here still draws, labelled at its middle.
export const AREA_MAP_STYLE: Record<string, { fill: string, label: { x: number, y: number } }> = {
  'grad-krizevci': { fill: 'var(--pz-map-3)', label: { x: 960, y: 640 } },
  'opcina-gornja-rijeka': { fill: 'var(--pz-map-1)', label: { x: 240, y: 560 } },
  'opcina-kalnik': { fill: 'var(--pz-map-2)', label: { x: 540, y: 350 } },
  'opcina-sveti-ivan-zabno': { fill: 'var(--pz-map-2)', label: { x: 1240, y: 1260 } },
  'opcina-sveti-petar-orehovec': { fill: 'var(--pz-map-4)', label: { x: 420, y: 790 } }
}

export interface MapBox { x: number, y: number, width: number, height: number }

/** The vertices of an SVG path made of absolute M/L commands (the boundary paths, one ring each). */
export function pathPoints(d: string): Array<[number, number]> {
  return [...d.matchAll(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g)].map(([, x, y]) => [Number(x), Number(y)])
}

/** The bounding box of a ring of points. */
export function pointsBox(points: Array<[number, number]>): MapBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of points) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** Whether (x, y) lies inside the ring (even-odd rule). */
export function insideRing(x: number, y: number, ring: Array<[number, number]>): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!
    const [xj, yj] = ring[j]!
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** The union of boxes. */
export function unionBox(boxes: MapBox[]): MapBox {
  const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y))
  const right = Math.max(...boxes.map(b => b.x + b.width)), bottom = Math.max(...boxes.map(b => b.y + b.height))
  return { x, y, width: right - x, height: bottom - y }
}

/**
 * A box around `box` with `pad` (a share of its larger side) on every side, widened or heightened to `aspect`
 * (width / height) about its centre, so the map keeps one shape whatever it shows.
 */
export function fitBox(box: MapBox, aspect: number, pad = 0.04): MapBox {
  const margin = Math.max(box.width, box.height) * pad
  let width = box.width + 2 * margin
  let height = box.height + 2 * margin
  if (width / height < aspect) width = height * aspect
  else height = width / aspect
  return { x: box.x + box.width / 2 - width / 2, y: box.y + box.height / 2 - height / 2, width, height }
}
