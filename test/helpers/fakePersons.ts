import type { PublicContentRows } from '../../server/utils/publicContent'
import { fakeContentRows } from './fakeContentSeed'

// Persons for the committed atlas seed (which predates persons). Ids point at seed rows:
// Kalnik settlement and municipality, the church "Crkva sv. Brcka" and the first seed source.
export const PERSON_IDS = {
  kalnikMunicipality: '3ec91b7d-9dbf-87ca-a0b9-8621b7e059e3',
  kalnikSettlement: '3d88043c-4997-87db-a1a5-8ac411bed9f0',
  grad: '92140ed6-6420-81d0-8661-91ce0c257f5f',
  church: '42328721-7d0b-87e1-a730-721d5b0393e6',
  source: '079197d2-df22-88d1-afb4-7a8d173486da',
  live: '00000000-0000-4000-8000-000000000a01',
  archived: '00000000-0000-4000-8000-000000000a02',
  outsideOnly: '00000000-0000-4000-8000-000000000a03',
  noindex: '00000000-0000-4000-8000-000000000a04',
  inGrad: '00000000-0000-4000-8000-000000000a05',
  outsideArea: '00000000-0000-4000-8000-000000000a99'
} as const

const T = '2026-11-02T10:00:00.000Z'

function person(id: string, name: string, slug: string, extra: Record<string, unknown> = {}) {
  return {
    id, name, slug, role: 'književnik', clue: 'Natuknica bez imena.', bio: null, born: null, born_year: null, born_place: null,
    died: '1900.', died_year: 1900, died_place: null, open_questions: null, verification: 'unverified',
    noindex: false, status: 'published', updated_at: T, ...extra
  }
}

export function fakePersonRows(): Required<Pick<PublicContentRows, 'persons' | 'personAreas' | 'personItems' | 'personSources'>> {
  return {
    persons: [
      person(PERSON_IDS.live, 'Ivan Kalničan', 'ivan-kalnican', {
        role: 'kapelan i pjesnik', bio: 'Kratka biografija.', born: '14. 1. 1813.', born_year: 1813, born_place: 'Edde (HU)',
        died: '5. 9. 1849.', died_year: 1849, died_place: 'Križevci', open_questions: 'Godina smrti 1849. ili 1850.'
      }),
      person(PERSON_IDS.archived, 'Stara Osoba', 'stara-osoba', { status: 'archived' }),
      person(PERSON_IDS.outsideOnly, 'Vanjska Osoba', 'vanjska-osoba'),
      person(PERSON_IDS.noindex, 'Anja Skrivena', 'anja-skrivena', { noindex: true, born_year: 1700, died_year: 1780, died: '1780.' }),
      person(PERSON_IDS.inGrad, 'Ana Gradska', 'ana-gradska', { role: 'učiteljica', born_year: 1844, died_year: 1910, died: '1910.' })
    ],
    personAreas: [
      { person_id: PERSON_IDS.live, area_id: PERSON_IDS.kalnikSettlement, role: 'rodjen', position: 0 },
      { person_id: PERSON_IDS.live, area_id: PERSON_IDS.kalnikSettlement, role: 'umro', position: 1 },
      { person_id: PERSON_IDS.live, area_id: PERSON_IDS.outsideArea, role: 'zivio', position: 2 },
      { person_id: PERSON_IDS.archived, area_id: PERSON_IDS.kalnikSettlement, role: 'rodjen', position: 0 },
      { person_id: PERSON_IDS.outsideOnly, area_id: PERSON_IDS.outsideArea, role: 'rodjen', position: 0 },
      { person_id: PERSON_IDS.noindex, area_id: PERSON_IDS.kalnikMunicipality, role: 'zivio', position: 0 },
      { person_id: PERSON_IDS.inGrad, area_id: PERSON_IDS.grad, role: 'djelovao', position: 0 }
    ],
    personItems: [
      { person_id: PERSON_IDS.live, item_id: PERSON_IDS.church, relation: 'kapela mu je posvećena', position: 0 },
      { person_id: PERSON_IDS.live, item_id: '00000000-0000-4000-8000-000000000f99', relation: 'nepoznata stavka', position: 1 }
    ],
    personSources: [
      { person_id: PERSON_IDS.live, source_id: PERSON_IDS.source, position: 0 },
      { person_id: PERSON_IDS.live, source_id: '00000000-0000-4000-8000-000000000e99', position: 1 }
    ]
  }
}

/** The atlas seed plus the persons above, plus a slug-history row for an old slug of the live person. */
export function fakeRowsWithPersons(): PublicContentRows {
  const rows = fakeContentRows()
  return {
    ...rows,
    ...fakePersonRows(),
    slugHistory: [...rows.slugHistory, { kind: 'person', namespace: '', scope_id: null, slug: 'ivan-stari', entity_id: PERSON_IDS.live }]
  }
}
