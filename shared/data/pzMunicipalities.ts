/** Official settlement and sacral-heritage item counts for the five project municipalities (scout catalog, 2026-10). */
export const PZ_MUNICIPALITY_IDS = [
  'krizevci',
  'kalnik',
  'gornjaRijeka',
  'svetiPetarOrehovec',
  'svetiIvanZabno'
] as const

export type PzMunicipalityId = typeof PZ_MUNICIPALITY_IDS[number]

export const PZ_MUNICIPALITY_STATS: Record<PzMunicipalityId, { settlements: number, items: number }> = {
  krizevci: { settlements: 60, items: 34 },
  kalnik: { settlements: 8, items: 6 },
  gornjaRijeka: { settlements: 14, items: 3 },
  svetiPetarOrehovec: { settlements: 37, items: 21 },
  svetiIvanZabno: { settlements: 16, items: 43 }
}
