import type { PlaceOption } from '../../shared/types/place'
import catalog from '../data/places/hr.json'

export const PLACE_CATALOG_VERSION = catalog.version
export const PLACE_QUERY_MAX = 80
export const PLACE_RESULT_MAX = 8

// Potkalničko prigorje: five municipalities as named in hr.json (Grad Križevci → "Križevci").
export const CONTRIBUTION_MUNICIPALITIES = [
  'Križevci',
  'Kalnik',
  'Gornja Rijeka',
  'Sveti Petar Orehovec',
  'Sveti Ivan Žabno'
] as const

export interface CatalogPlace extends PlaceOption {
  aliases: string[]
  countryCode: string
  active: boolean
  latitude: number | null
  longitude: number | null
}

// Imported once by the server; never imported by a page or shared validator.
const places: CatalogPlace[] = catalog.places
const byId = new Map(places.map(place => [place.id, place]))

const contributionMunicipalities = new Set<string>(CONTRIBUTION_MUNICIPALITIES)

export function foldPlace(value: string, dj = false) {
  return value.toLocaleLowerCase('hr').replaceAll('đ', dj ? 'dj' : 'd')
    .normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim()
}

export function placeById(id: string) {
  return byId.get(id)
}

export function isContributionPlace(place: CatalogPlace) {
  return place.active && place.countryCode === 'HR' && contributionMunicipalities.has(place.municipality)
}

export function resolveActivePlace(id: string) {
  const place = placeById(id)
  return place?.active && place.countryCode === 'HR' ? place : undefined
}

export function resolveContributionPlace(id: string) {
  const place = placeById(id)
  return place && isContributionPlace(place) ? place : undefined
}

// Stable, unambiguous, and comfortably below the existing 120-character DB limit.
// Longer administrative context is resolved separately from the trusted catalog.
export function placeSnapshot(place: CatalogPlace) {
  return `${place.name} (${place.id})`
}

function buildSearchIndex(filter: (place: CatalogPlace) => boolean) {
  return places.filter(filter).map(place => ({
    place,
    name: foldPlace(place.name),
    aliases: [...new Set([place.name, ...place.aliases].flatMap(name => [foldPlace(name), foldPlace(name, true)]))],
    context: foldPlace(`${place.name} ${place.municipality} ${place.county}`)
  }))
}

const catalogIndex = buildSearchIndex(place => place.active && place.countryCode === 'HR')
const contributionIndex = buildSearchIndex(isContributionPlace)

function searchIndex(index: ReturnType<typeof buildSearchIndex>, query: string): PlaceOption[] {
  if (query.length > PLACE_QUERY_MAX || query.trim().length < 2) return []
  const q = foldPlace(query)
  if (q.length < 2) return []
  const tokens = q.split(' ')
  return index.flatMap(({ place, name, aliases, context }) => {
    const rank = name === q
      ? 0
      : aliases.includes(q)
        ? 1
        : name.startsWith(q)
          ? 2
          : aliases.some(alias => alias.startsWith(q))
            ? 3
            : name.includes(q)
              ? 4
              : aliases.some(alias => alias.includes(q))
                ? 5
                : tokens.every(token => context.includes(token)) ? 6 : -1
    return rank < 0 ? [] : [{ place, rank, name }]
  }).sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'hr')
    || a.place.county.localeCompare(b.place.county, 'hr')
    || a.place.municipality.localeCompare(b.place.municipality, 'hr')
    || a.place.id.localeCompare(b.place.id))
    .slice(0, PLACE_RESULT_MAX)
    .map(({ place }) => ({ id: place.id, name: place.name, municipality: place.municipality, county: place.county }))
}

export function searchPlaces(query: string): PlaceOption[] {
  return searchIndex(catalogIndex, query)
}

export function searchContributionPlaces(query: string): PlaceOption[] {
  return searchIndex(contributionIndex, query)
}

export const CONTRIBUTION_PLACE_COUNT = contributionIndex.length
