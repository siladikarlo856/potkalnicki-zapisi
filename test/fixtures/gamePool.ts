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
  sopron: id(14),
  borje: id(15),
  kamesnica: id(16),
  potok: id(17),
  popovec: id(18),
  obrez: id(40),
  vojnovec: id(41),
  gornjaRijeka: id(4),
  gornjaSelo: id(19),
  church: id(20),
  chapel: id(21),
  ana: id(30),
  marko: id(31),
  personA: id(50),
  personB: id(51),
  personC: id(52),
  personD: id(53)
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
      area({ id: FIXTURE_IDS.gornjaRijeka, kind: 'municipality', name: 'Gornja Rijeka', slug: 'opcina-gornja-rijeka' }),
      area({ id: FIXTURE_IDS.town, kind: 'town', name: 'Križevci', slug: 'grad-krizevci' }),
      area({ id: FIXTURE_IDS.krizevci, kind: 'settlement', name: 'Križevci', slug: 'krizevci', parent_id: FIXTURE_IDS.town, latitude: 46.02, longitude: 16.54 }),
      area({ id: FIXTURE_IDS.apatovec, kind: 'settlement', name: 'Apatovec', slug: 'apatovec', parent_id: FIXTURE_IDS.town, latitude: 46.03, longitude: 16.55 }),
      area({ id: FIXTURE_IDS.kalnikSettlement, kind: 'settlement', name: 'Kalnik', slug: 'kalnik', parent_id: FIXTURE_IDS.kalnik, latitude: 46.12833, longitude: 16.4625 }),
      area({ id: FIXTURE_IDS.borje, kind: 'settlement', name: 'Borje', slug: 'borje', parent_id: FIXTURE_IDS.kalnik, latitude: 46.12245, longitude: 16.44637 }),
      area({ id: FIXTURE_IDS.kamesnica, kind: 'settlement', name: 'Kamešnica', slug: 'kamesnica', parent_id: FIXTURE_IDS.kalnik, latitude: 46.12673, longitude: 16.50378 }),
      area({ id: FIXTURE_IDS.sopron, kind: 'settlement', name: 'Šopron', slug: 'sopron', parent_id: FIXTURE_IDS.kalnik, latitude: 46.12059, longitude: 16.46437 }),
      area({ id: FIXTURE_IDS.potok, kind: 'settlement', name: 'Potok Kalnički', slug: 'potok-kalnicki', parent_id: FIXTURE_IDS.kalnik, latitude: 46.11366, longitude: 16.48131 }),
      area({ id: FIXTURE_IDS.popovec, kind: 'settlement', name: 'Popovec Kalnički', slug: 'popovec-kalnicki', parent_id: FIXTURE_IDS.kalnik, latitude: 46.11016, longitude: 16.43329 }),
      area({ id: FIXTURE_IDS.obrez, kind: 'settlement', name: 'Obrež Kalnički', slug: 'obrez-kalnicki', parent_id: FIXTURE_IDS.kalnik, latitude: 46.11716, longitude: 16.43503 }),
      area({ id: FIXTURE_IDS.vojnovec, kind: 'settlement', name: 'Vojnovec Kalnički', slug: 'vojnovec-kalnicki', parent_id: FIXTURE_IDS.kalnik, latitude: 46.12008, longitude: 16.42355 }),
      area({ id: FIXTURE_IDS.farSettlement, kind: 'settlement', name: 'Dugo Selo Topolsko', slug: 'dugo-selo', parent_id: FIXTURE_IDS.town, latitude: 46.2, longitude: 16.8 }),
      area({ id: FIXTURE_IDS.gornjaSelo, kind: 'settlement', name: 'Donja Rijeka', slug: 'donja-rijeka', parent_id: FIXTURE_IDS.gornjaRijeka, latitude: 46.08, longitude: 16.35 }),
      area({ id: id(42), kind: 'settlement', name: 'Mala Rijeka', slug: 'mala-rijeka', parent_id: FIXTURE_IDS.gornjaRijeka, latitude: 46.09, longitude: 16.36 }),
      area({ id: id(43), kind: 'settlement', name: 'Velika Rijeka', slug: 'velika-rijeka', parent_id: FIXTURE_IDS.gornjaRijeka, latitude: 46.07, longitude: 16.34 }),
      area({ id: id(44), kind: 'settlement', name: 'Gornja Rijeka', slug: 'gornja-rijeka', parent_id: FIXTURE_IDS.gornjaRijeka, latitude: 46.06, longitude: 16.33 })
    ],
    areaRegions: [FIXTURE_IDS.town, FIXTURE_IDS.kalnik, FIXTURE_IDS.gornjaRijeka].map(area_id => ({ area_id, region_id: FIXTURE_IDS.region })),
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
    slugHistory: [],
    persons: [
      {
        id: FIXTURE_IDS.personA, name: 'Ana Prva', slug: 'ana-prva', role: 'učiteljica', clue: 'Prva natuknica bez imena.',
        bio: null, born: '1800.', born_year: 1800, born_place: null, died: '1850.', died_year: 1850, died_place: null,
        open_questions: null, verification: 'verified', noindex: false, status: 'published', updated_at: '2026-11-01T10:00:00+00:00'
      },
      {
        id: FIXTURE_IDS.personB, name: 'Bruno Drugi', slug: 'bruno-drugi', role: 'kapelan', clue: 'Druga natuknica bez imena.',
        bio: null, born: '1810.', born_year: 1810, born_place: null, died: '1860.', died_year: 1860, died_place: null,
        open_questions: null, verification: 'verified', noindex: false, status: 'published', updated_at: '2026-11-01T10:00:00+00:00'
      },
      {
        id: FIXTURE_IDS.personC, name: 'Cvijeta Treća', slug: 'cvijeta-treca', role: 'pjevačica', clue: 'Treća natuknica bez imena.',
        bio: null, born: '1820.', born_year: 1820, born_place: null, died: '1870.', died_year: 1870, died_place: null,
        open_questions: null, verification: 'verified', noindex: false, status: 'published', updated_at: '2026-11-01T10:00:00+00:00'
      },
      {
        id: FIXTURE_IDS.personD, name: 'Damir Četvrti', slug: 'damir-cetvrti', role: 'skladatelj', clue: 'Četvrta natuknica bez imena.',
        bio: null, born: '1830.', born_year: 1830, born_place: null, died: '1880.', died_year: 1880, died_place: null,
        open_questions: null, verification: 'verified', noindex: false, status: 'published', updated_at: '2026-11-01T10:00:00+00:00'
      }
    ],
    personAreas: [
      { person_id: FIXTURE_IDS.personA, area_id: FIXTURE_IDS.krizevci, role: 'rodjen', position: 0 },
      { person_id: FIXTURE_IDS.personB, area_id: FIXTURE_IDS.apatovec, role: 'rodjen', position: 0 },
      { person_id: FIXTURE_IDS.personC, area_id: FIXTURE_IDS.kalnikSettlement, role: 'rodjen', position: 0 },
      { person_id: FIXTURE_IDS.personD, area_id: FIXTURE_IDS.farSettlement, role: 'rodjen', position: 0 }
    ],
    personItems: [],
    personSources: []
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
