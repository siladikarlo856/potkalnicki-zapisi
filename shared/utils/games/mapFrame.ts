export const MAP_FRAME = {
  west: 16.3298,
  east: 16.7322,
  south: 45.9187,
  north: 46.1584,
  width: 1600,
  height: 1373
} as const

export type MapLayerId = 'karta' | 'reljef' | 'satelit'

export const MAP_LAYERS = [
  {
    id: 'karta' as const,
    label: 'Karta',
    src: '/potkalnicko-prigorje/karta/karta.webp',
    attribution: '© OpenStreetMap suradnici · OpenFreeMap',
    available: true
  },
  {
    id: 'reljef' as const,
    label: 'Reljef',
    src: '/potkalnicko-prigorje/karta/reljef.webp',
    attribution: '© OpenStreetMap suradnici · reljef: Terrain-Tiles (AWS open data)',
    available: true
  },
  {
    id: 'satelit' as const,
    label: 'Satelit',
    src: '/potkalnicko-prigorje/karta/satelit.webp',
    attribution: 'Ortofoto © Državna geodetska uprava (DOF 2023)',
    available: false
  }
] as const

const EARTH_RADIUS_KM = 6371

function mercY(lat: number): number {
  return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))
}

export function project(lat: number, lng: number): { x: number, y: number } {
  const { west, east, south, north, width, height } = MAP_FRAME
  const x = (lng - west) / (east - west) * width
  const y = (mercY(north) - mercY(lat)) / (mercY(north) - mercY(south)) * height
  return { x, y }
}

export function unproject(x: number, y: number): { lat: number, lng: number } {
  const { west, east, south, north, width, height } = MAP_FRAME
  const lng = west + x / width * (east - west)
  const latMerc = mercY(north) - y / height * (mercY(north) - mercY(south))
  const lat = Math.atan(Math.sinh(latMerc)) * 180 / Math.PI
  return { lat, lng }
}

export function distanceKm(a: { lat: number, lng: number }, b: { lat: number, lng: number }): number {
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s))
}

export function distanceScore(km: number): number {
  if (km >= 5) return 0
  if (km <= 0) return 1000
  return Math.round((1 - km / 5) * 1000 / 10) * 10
}
