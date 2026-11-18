import type { PublicContentRows } from '../../server/utils/publicContent'
import type { IntangibleLinkRows, IntangibleRow, IntangibleRows, KeyedRow, NarratorRow, ThemeRow } from '../../server/utils/publicIntangibleContent'
import { NO_INTANGIBLE_ROWS } from '../../server/utils/publicIntangibleContent'
import { PERSON_IDS, fakeRowsWithPersons } from './fakePersons'

// Intangible heritage on top of the persons fixture (which sits on the committed atlas seed): the kinds, a named
// narrator, an unnamed one, one whose slug gives the name away, archived rows, and links to places, items, persons,
// sources and words that are public and that are not. Ids point at seed rows where they must (Kalnik, the church,
// the first source, the region).

export const REGION_ID = '85e561aa-2656-8fe2-9fa5-21ea34ff409e'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export const IH = {
  region: REGION_ID,
  kalnikMunicipality: PERSON_IDS.kalnikMunicipality,
  kalnikSettlement: PERSON_IDS.kalnikSettlement,
  grad: PERSON_IDS.grad,
  outsideArea: PERSON_IDS.outsideArea,
  church: PERSON_IDS.church,
  source: PERSON_IDS.source,
  person: PERSON_IDS.live,
  otherPerson: PERSON_IDS.inGrad,
  storyType: id(0x101), oldStoryType: id(0x102), customType: id(0x103), folkType: id(0x104), draftType: id(0x105),
  occasion: id(0x111),
  themeVino: id(0x121), themeArchived: id(0x122), themeEmpty: id(0x123),
  narratorNamed: id(0x131), narratorAnon: id(0x132), narratorLeak: id(0x133), narratorArchived: id(0x134), narratorNoDescription: id(0x135),
  story: id(0x141), storyArchived: id(0x142), storyOldType: id(0x143), storyUnknownType: id(0x144), storyNoindex: id(0x145),
  custom: id(0x151), customArchived: id(0x152),
  folk: id(0x161), folkOrphan: id(0x162),
  word: id(0x171), wordDead: id(0x172)
}

const T = '2026-11-05T10:00:00.000Z'

function keyed(rowId: string, key: string, label: string, sort: number, status: 'published' | 'archived' = 'published'): KeyedRow {
  return { id: rowId, key, label_hr: label, sort, status }
}

function theme(rowId: string, slug: string, label: string, status: 'published' | 'archived' = 'published'): ThemeRow {
  return { id: rowId, slug, label_hr: label, description: 'Što se pilo i sadilo.', sort: 0, status, updated_at: T }
}

function narrator(rowId: string, extra: Partial<NarratorRow> & Pick<NarratorRow, 'name' | 'slug'>): NarratorRow {
  return {
    id: rowId, public_description: null, consent_named: false, living: true, born_year: null, settlement_id: null, person_id: null,
    noindex: false, status: 'published', updated_at: T,
    // Columns the loader never selects: present on the row to prove nothing copies them.
    ...({ consent_note: 'PRIVATNI-PRISTANAK', research_notes: 'PRIVATNA-BILJESKA-KAZIVACA', search_text: 'PRIVATNI-TRAZILICA-TEKST' } as object),
    ...extra
  } as NarratorRow
}

function record(rowId: string, title: string, slug: string, typeId: string, extra: Partial<IntangibleRow> = {}): IntangibleRow {
  return {
    id: rowId, title, slug, type_id: typeId, text_local: null, text_standard: null, description: null, quotes: [], period: null,
    period_unit: null, period_value: null, recorded_precision: null, recorded_year: null, recorded_month: null, recorded_day: null,
    verification: 'unverified', noindex: false, credits: [], status: 'published', updated_at: T,
    ...({ research_notes: 'PRIVATNA-BILJESKA-ZAPISA', search_text: 'PRIVATNI-TRAZILICA-TEKST' } as object),
    ...extra
  } as IntangibleRow
}

const noLinks = (): IntangibleLinkRows => ({ areas: [], narrators: [], authors: [], items: [], themes: [], sources: [] })
const area = (record_id: string, area_id: string, relation: string, position: number) => ({ record_id, area_id, relation, position })
const narratorLink = (record_id: string, narrator_id: string, role: string, position: number) => ({ record_id, narrator_id, role, position })

export function fakeIntangibleRows(): IntangibleRows {
  return {
    ...NO_INTANGIBLE_ROWS,
    types: {
      story: [
        keyed(IH.storyType, 'legenda', 'legenda/predaja', 1),
        keyed(IH.oldStoryType, 'stara', 'stara vrsta', 2, 'archived')
      ],
      custom: [keyed(IH.customType, 'godisnji', 'godišnji običaji', 1)],
      folk_text: [keyed(IH.folkType, 'pjesma', 'pjesma', 1)]
    },
    occasions: [keyed(IH.occasion, 'martinje', 'Martinje', 1)],
    themes: [
      theme(IH.themeVino, 'vino', 'Vino'),
      theme(IH.themeArchived, 'arhivirana', 'Arhivirana tema', 'archived'),
      theme(IH.themeEmpty, 'prazna', 'Prazna tema')
    ],
    narrators: [
      narrator(IH.narratorNamed, {
        name: 'Marija Horvat', slug: 'marija-horvat', consent_named: true, public_description: 'kazivačica, r. 1938., Gornji Fodrovec',
        living: false, born_year: 1938, settlement_id: IH.kalnikSettlement, person_id: IH.person
      }),
      narrator(IH.narratorAnon, {
        name: 'Ivan Novak', slug: 'kazivac-r-1950-kalnik', consent_named: false, public_description: 'kazivač, r. 1950., Kalnik',
        living: true, born_year: 1950, settlement_id: IH.kalnikSettlement, person_id: IH.otherPerson
      }),
      narrator(IH.narratorLeak, { name: 'Josip Kovač', slug: 'josip-kovac', public_description: 'kazivač iz Kalnika' }),
      narrator(IH.narratorArchived, { name: 'Stara Kazivačica', slug: 'stara-kazivacica', consent_named: true, status: 'archived' }),
      narrator(IH.narratorNoDescription, { name: 'Petar Bezopisa', slug: 'kazivac-bez-opisa', public_description: null })
    ],
    records: {
      story: [
        record(IH.story, 'Kalnička vještica', 'kalnicka-vjestica', IH.storyType, {
          text_local: 'Kaj je bilo, bilo je.\nI vu Kalniku.', text_standard: 'Što je bilo, bilo je.',
          period: 'u turska vremena', period_unit: 'century', period_value: 17,
          recorded_precision: 'day', recorded_year: 1987, recorded_month: 3, recorded_day: 12, verification: 'verified',
          credits: [{ name: 'Ana Pošiljateljica', kind: 'memory' }, { bad: true }]
        }),
        record(IH.storyArchived, 'Skinuta priča', 'skinuta-prica', IH.storyType, { text_local: 'x', status: 'archived' }),
        record(IH.storyOldType, 'Priča stare vrste', 'prica-stare-vrste', IH.oldStoryType, { text_local: 'Stara vrsta.' }),
        record(IH.storyUnknownType, 'Priča bez vrste', 'prica-bez-vrste', id(0x1ff), { text_local: 'Nema vrste.' }),
        record(IH.storyNoindex, 'Skrivena priča', 'skrivena-prica', IH.storyType, { text_standard: 'Ne za tražilice.', noindex: true })
      ],
      custom: [
        record(IH.custom, 'Martinje u Kalniku', 'martinje-u-kalniku', IH.customType, {
          occasion_id: IH.occasion, description: 'Mošt se krstio u vino.', quotes: ['Sveti Martin, krsti vino!', 5, ' '],
          steps: ['Natoči mošt.', 'Izgovori zdravicu.'],
          period: null, period_unit: 'decade', period_value: 1960, recorded_precision: 'month', recorded_year: 1990, recorded_month: 11
        }),
        record(IH.customArchived, 'Napušteni običaj', 'napusteni-obicaj', IH.customType, { description: 'Više se ne radi.', status: 'archived' })
      ],
      folk_text: [
        record(IH.folk, 'Martinjska zdravica', 'martinjska-zdravica', IH.folkType, {
          custom_id: IH.custom, text_local: 'Živio Martin, živilo vino!', recorded_precision: 'year', recorded_year: 1975
        }),
        record(IH.folkOrphan, 'Pjesma bez običaja', 'pjesma-bez-obicaja', IH.folkType, { custom_id: IH.customArchived, text_standard: 'Pjesma.' })
      ]
    },
    links: {
      story: {
        ...noLinks(),
        areas: [
          area(IH.story, IH.kalnikSettlement, 'recorded_in', 0),
          area(IH.story, IH.region, 'about', 1),
          area(IH.story, IH.outsideArea, 'about', 2),
          area(IH.storyNoindex, IH.grad, 'recorded_in', 0)
        ],
        narrators: [
          narratorLink(IH.story, IH.narratorNamed, 'narrator', 0),
          narratorLink(IH.story, IH.narratorAnon, 'narrator', 1),
          narratorLink(IH.story, IH.narratorNamed, 'collector', 2),
          narratorLink(IH.story, IH.narratorArchived, 'narrator', 3),
          narratorLink(IH.story, IH.narratorLeak, 'narrator', 4),
          narratorLink(IH.story, IH.narratorNoDescription, 'collector', 5)
        ],
        authors: [{ record_id: IH.story, person_id: IH.person, position: 0 }, { record_id: IH.story, person_id: id(0x1fe), position: 1 }],
        items: [{ record_id: IH.story, item_id: IH.church, position: 0 }, { record_id: IH.story, item_id: id(0x1fd), position: 1 }],
        themes: [
          { record_id: IH.story, theme_id: IH.themeVino, position: 0 },
          { record_id: IH.story, theme_id: IH.themeArchived, position: 1 },
          { record_id: IH.storyNoindex, theme_id: IH.themeVino, position: 0 }
        ],
        sources: [{ record_id: IH.story, source_id: IH.source, position: 0 }, { record_id: IH.story, source_id: id(0x1fc), position: 1 }]
      },
      custom: {
        ...noLinks(),
        areas: [area(IH.custom, IH.kalnikMunicipality, 'recorded_in', 0)],
        narrators: [narratorLink(IH.custom, IH.narratorAnon, 'collector', 0)],
        themes: [{ record_id: IH.custom, theme_id: IH.themeVino, position: 0 }]
      },
      folk_text: {
        ...noLinks(),
        areas: [area(IH.folk, IH.kalnikSettlement, 'recorded_in', 0)],
        narrators: [narratorLink(IH.folk, IH.narratorNamed, 'narrator', 0)],
        themes: [{ record_id: IH.folk, theme_id: IH.themeVino, position: 0 }]
      }
    },
    folkTextWords: [
      { record_id: IH.folk, word_id: IH.word, position: 0 },
      { record_id: IH.folk, word_id: IH.wordDead, position: 1 }
    ],
    // wordDead is not live (inactive or archived), so the loader never returns it.
    words: [{ id: IH.word, slug: 'martin', headword: 'Martin' }]
  }
}

/** The persons snapshot rows plus intangible heritage and slug history for an old slug of a story and of narrators. */
export function fakeRowsWithIntangible(): PublicContentRows {
  const rows = fakeRowsWithPersons()
  return {
    ...rows,
    intangible: fakeIntangibleRows(),
    slugHistory: [
      ...rows.slugHistory,
      { kind: 'story', namespace: '', scope_id: null, slug: 'stara-vjestica', entity_id: IH.story },
      { kind: 'story', namespace: '', scope_id: null, slug: 'skinuta-stara', entity_id: IH.storyArchived },
      { kind: 'theme', namespace: '', scope_id: null, slug: 'vinogradi', entity_id: IH.themeVino },
      { kind: 'narrator', namespace: '', scope_id: null, slug: 'kazivac-r-1950', entity_id: IH.narratorAnon },
      { kind: 'narrator', namespace: '', scope_id: null, slug: 'ivan-novak', entity_id: IH.narratorAnon },
      { kind: 'narrator', namespace: '', scope_id: null, slug: 'marija-h', entity_id: IH.narratorNamed }
    ]
  }
}
