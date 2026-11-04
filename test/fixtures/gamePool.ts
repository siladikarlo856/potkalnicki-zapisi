import type { WordEntry } from '../../app/types/heritage'
import { buildCardPool } from '../../server/utils/cardPool'
import { buildPublicContent, ATLAS_REGION_SLUG, type PublicContentRows } from '../../server/utils/publicContent'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export const FIXTURE_IDS = {
  region: id(1),
  town: id(2),
  kalnik: id(3),
  krizevci: id(10),
  apatovec: id(11),
  kalnikSettlement: id(12),
  farSettlement: id(13),
  church: id(20),
  chapel: id(21),
  ana: id(30),
  marko: id(31)
}

function area(row: Partial<PublicContentRows['areas'][number]> & Pick<PublicContentRows['areas'][number], 'id' | 'kind' | 'name'>) {
  return {
    parent_id: null, slug: null, official_code: null, latitude: null, longitude: null, status: 'published' as const,
    updated_at: '2026-11-01T10:00:00+00:00', ...row
  }
}

function item(row: Partial<PublicContentRows['items'][number]> & Pick<PublicContentRows['items'][number], 'id' | 'name' | 'slug' | 'municipality_id'>) {
  return {
    category_id: FIXTURE_IDS.church, settlement_id: null, locality: null, verification: 'verified' as const,
    heritage_status: null, registry_number: 'REG', period: null, description: 'desc', research_notes: 'notes secret',
    latitude: null, longitude: null, noindex: false, credits: [], status: 'published' as const,
    updated_at: '2026-11-01T10:00:00+00:00', ...row
  }
}

export function gamePoolRows(): PublicContentRows {
  return {
    areas: [
      area({ id: FIXTURE_IDS.region, kind: 'region', name: 'Potkalničko prigorje', slug: ATLAS_REGION_SLUG }),
      area({ id: FIXTURE_IDS.kalnik, kind: 'municipality', name: 'Kalnik', slug: 'opcina-kalnik' }),
      area({ id: FIXTURE_IDS.town, kind: 'town', name: 'Križevci', slug: 'grad-krizevci' }),
      area({ id: FIXTURE_IDS.krizevci, kind: 'settlement', name: 'Križevci', slug: 'krizevci', parent_id: FIXTURE_IDS.town, latitude: 46.02, longitude: 16.54 }),
      area({ id: FIXTURE_IDS.apatovec, kind: 'settlement', name: 'Apatovec', slug: 'apatovec', parent_id: FIXTURE_IDS.town, latitude: 46.03, longitude: 16.55 }),
      area({ id: FIXTURE_IDS.kalnikSettlement, kind: 'settlement', name: 'Kalnik', slug: 'kalnik', parent_id: FIXTURE_IDS.kalnik, latitude: 46.04, longitude: 16.56 }),
      area({ id: FIXTURE_IDS.farSettlement, kind: 'settlement', name: 'Dugo Selo Topolsko', slug: 'dugo-selo', parent_id: FIXTURE_IDS.town, latitude: 46.2, longitude: 16.8 })
    ],
    areaRegions: [FIXTURE_IDS.town, FIXTURE_IDS.kalnik].map(area_id => ({ area_id, region_id: FIXTURE_IDS.region })),
    categories: [
      { id: FIXTURE_IDS.church, key: 'church', label_hr: 'Crkva', sort: 1, status: 'published' },
      { id: FIXTURE_IDS.chapel, key: 'chapel', label_hr: 'Kapela', sort: 2, status: 'published' }
    ],
    sources: [],
    items: [
      item({ id: FIXTURE_IDS.ana, name: 'Crkva sv. Ane', slug: 'crkva-sv-ane', municipality_id: FIXTURE_IDS.town, settlement_id: FIXTURE_IDS.krizevci }),
      item({ id: FIXTURE_IDS.marko, name: 'Kapela sv. Marka', slug: 'kapela-marka', category_id: FIXTURE_IDS.chapel, municipality_id: FIXTURE_IDS.town, settlement_id: FIXTURE_IDS.apatovec })
    ],
    itemSources: [],
    clubs: [],
    clubSeasons: [],
    clubSources: [],
    legacyIds: [],
    slugHistory: []
  }
}

export function gamePoolWords(): WordEntry[] {
  return [
    {
      id: 'w-krumper', headword: 'krumper', meaning: { hr: 'krumpir', en: 'potato' }, category: 'food', partOfSpeech: 'imenica, muški rod',
      variants: [{ id: 'v1', form: 'krumper', status: 'verified', usages: [] }], status: 'verified', sources: [{ id: 's1', kind: 'editor' }]
    },
    {
      id: 'w-avijon', headword: 'avijon', meaning: { hr: 'avion', en: 'airplane' }, category: 'work', partOfSpeech: 'imenica, muški rod',
      variants: [{ id: 'v2', form: 'avijon', status: 'verified', usages: [] }], status: 'verified', sources: [{ id: 's2', kind: 'editor' }]
    },
    {
      id: 'w-afinger', headword: 'afinger', meaning: { hr: 'vješalica', en: 'hanger' }, category: 'clothing', partOfSpeech: 'imenica, ženski rod',
      variants: [{ id: 'v3', form: 'afinger', status: 'verified', usages: [] }], status: 'verified', sources: [{ id: 's3', kind: 'editor' }]
    },
    {
      id: 'w-mid', headword: 'srednja', meaning: { hr: 'srednji', en: 'middle' }, category: 'function', partOfSpeech: 'pridjev',
      variants: [{ id: 'v4', form: 'srednja', status: 'verified', usages: [] }], status: 'verified', sources: [{ id: 's4', kind: 'editor' }]
    }
  ]
}

export function fixtureCardPool() {
  const content = buildPublicContent(gamePoolRows(), { loadedAt: 0 })
  return buildCardPool(content, gamePoolWords())
}
