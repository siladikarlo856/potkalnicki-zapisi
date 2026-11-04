import type { CardPool, PoolMunicipality, PoolPlace } from '../learn/types'
import { distanceKm } from './distractors'
import type { Difficulty } from './types'
import type { Rng } from './rng'
import { shuffled } from './rng'

export const SELA_OPCINE_CHIP_COUNT = 8

export interface SelaOpcineChip {
  id: string
  name: string
  municipalityId: string
}

export interface SelaOpcineBucket {
  id: string
  label: string
}

export interface SelaOpcineBoard {
  chips: SelaOpcineChip[]
  buckets: SelaOpcineBucket[]
}

function placesByUnit(pool: CardPool): Map<string, PoolPlace[]> {
  const map = new Map<string, PoolPlace[]>()
  for (const card of pool.cards) {
    if (card.kind !== 'place') continue
    const list = map.get(card.municipalityId) ?? []
    list.push(card)
    map.set(card.municipalityId, list)
  }
  return map
}

function eligibleMunicipalities(pool: CardPool, byUnit: Map<string, PoolPlace[]>): PoolMunicipality[] {
  return pool.municipalities.filter(m => (byUnit.get(m.id)?.length ?? 0) > 0)
}

function farthestPair(municipalities: readonly PoolMunicipality[]): [PoolMunicipality, PoolMunicipality] | null {
  if (municipalities.length < 2) return null
  let best: [PoolMunicipality, PoolMunicipality] | null = null
  let bestD = -1
  for (let i = 0; i < municipalities.length; i++) {
    for (let j = i + 1; j < municipalities.length; j++) {
      const a = municipalities[i]!
      const b = municipalities[j]!
      const d = distanceKm(a.lat, a.lng, b.lat, b.lng)
      if (d > bestD) {
        bestD = d
        best = [a, b]
      }
    }
  }
  return best
}

function nearestTriple(municipalities: readonly PoolMunicipality[]): PoolMunicipality[] | null {
  if (municipalities.length < 3) return null
  let best: PoolMunicipality[] | null = null
  let bestSum = Infinity
  for (let i = 0; i < municipalities.length; i++) {
    for (let j = i + 1; j < municipalities.length; j++) {
      for (let k = j + 1; k < municipalities.length; k++) {
        const a = municipalities[i]!
        const b = municipalities[j]!
        const c = municipalities[k]!
        const sum = distanceKm(a.lat, a.lng, b.lat, b.lng)
          + distanceKm(a.lat, a.lng, c.lat, c.lng)
          + distanceKm(b.lat, b.lng, c.lat, c.lng)
        if (sum < bestSum) {
          bestSum = sum
          best = [a, b, c]
        }
      }
    }
  }
  return best
}

function pickPlaces(
  byUnit: Map<string, PoolPlace[]>,
  units: readonly PoolMunicipality[],
  rng: Rng
): PoolPlace[] | null {
  const quotas = units.length === 2 ? [4, 4] : [3, 3, 2]
  const picked: PoolPlace[] = []
  for (let i = 0; i < units.length; i++) {
    const unit = units[i]!
    const need = quotas[i]!
    const pool = shuffled(byUnit.get(unit.id) ?? [], rng)
    if (pool.length < need) return null
    picked.push(...pool.slice(0, need))
  }
  return shuffled(picked, rng)
}

function unitsForDifficulty(
  municipalities: readonly PoolMunicipality[],
  byUnit: Map<string, PoolPlace[]>,
  difficulty: Difficulty,
  rng: Rng
): PoolMunicipality[] | null {
  const minPerUnit = (count: number) => municipalities.filter(m => (byUnit.get(m.id)?.length ?? 0) >= count)
  if (difficulty === 'tesko') {
    const eligible = minPerUnit(3)
    if (eligible.length < 3) return null
    return nearestTriple(eligible)
  }
  const eligible = minPerUnit(4)
  if (eligible.length < 2) return null
  if (difficulty === 'lako') {
    const pair = farthestPair(eligible)
    return pair ? [...pair] : null
  }
  return shuffled(eligible, rng).slice(0, 2)
}

export function buildSelaOpcineBoard(pool: CardPool, difficulty: Difficulty, rng: Rng): SelaOpcineBoard | null {
  const byUnit = placesByUnit(pool)
  const municipalities = eligibleMunicipalities(pool, byUnit)
  if (municipalities.length < 2) return null

  const units = unitsForDifficulty(municipalities, byUnit, difficulty, rng)
  if (!units || units.length < 2) return null

  const places = pickPlaces(byUnit, units, rng)
  if (!places || places.length !== SELA_OPCINE_CHIP_COUNT) return null

  return {
    chips: places.map(p => ({ id: p.id, name: p.name, municipalityId: p.municipalityId })),
    buckets: units.map(u => ({ id: u.id, label: u.label }))
  }
}
