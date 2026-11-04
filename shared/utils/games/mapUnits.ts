import type { PoolMunicipality } from '../learn/types'

/** Stable colours for the five municipalities (light / dark Tailwind). */
const UNIT_PALETTE = [
  { light: '#059669', dark: '#34d399' },
  { light: '#0284c7', dark: '#38bdf8' },
  { light: '#d97706', dark: '#fbbf24' },
  { light: '#e11d48', dark: '#fb7185' },
  { light: '#7c3aed', dark: '#a78bfa' }
] as const

export function municipalityColor(municipalityId: string, municipalities: PoolMunicipality[], dark: boolean): string {
  const order = [...municipalities].sort((a, b) => a.slug.localeCompare(b.slug, 'hr'))
  const index = order.findIndex(m => m.id === municipalityId)
  const palette = UNIT_PALETTE[Math.max(0, index) % UNIT_PALETTE.length]!
  return dark ? palette.dark : palette.light
}

export function sortedMunicipalities(municipalities: PoolMunicipality[]): PoolMunicipality[] {
  return [...municipalities].sort((a, b) => a.slug.localeCompare(b.slug, 'hr'))
}
