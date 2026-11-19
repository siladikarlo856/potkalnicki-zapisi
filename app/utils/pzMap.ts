/** The schematic map of the four areas (a stand-in until real boundaries are loaded). viewBox 0 0 358 210. */
export const MAP_AREAS = [
  { id: 'gornja-rijeka', name: 'Gornja Rijeka', fill: 'var(--pz-map-1)', d: 'M18 62 108 40 124 110 38 122Z', lx: 70, ly: 88 },
  { id: 'kalnik', name: 'Kalnik', fill: 'var(--pz-map-2)', d: 'M108 40 216 32 226 100 124 110Z', lx: 170, ly: 82 },
  { id: 'sveti-petar-orehovec', name: 'Sv. Petar Orehovec', fill: 'var(--pz-map-3)', d: 'M38 122 124 110 226 100 236 150 120 176 50 160Z', lx: 138, ly: 142 },
  { id: 'krizevci', name: 'Križevci', fill: 'var(--pz-map-4)', d: 'M216 32 332 50 346 150 300 196 180 199 120 176 236 150 226 100Z', lx: 278, ly: 124 }
] as const
