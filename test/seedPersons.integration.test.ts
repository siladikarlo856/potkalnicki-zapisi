import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { integrationDb } from './support/integrationDb'

const db = await integrationDb()
const { sql } = db
const SEED_SLUGS = [
  'marko-krizevcanin',
  'ivan-vitez-od-sredne',
  'antun-nemcic',
  'sidonija-erdody-rubido',
  'vladimir-srecko-vrkljan',
  'zlatko-spoljar'
]

describe.skipIf(!db.enabled)('persons seed on Postgres', () => {
  it('replays idempotently with six persons, sources and resolved links', () => {
    const seed = readFileSync(new URL('../supabase/migrations/20261104050000_seed_persons.sql', import.meta.url), 'utf8')
    sql(seed)
    sql(seed)
    expect(Number(sql(`select count(*) from public.persons where status = 'published' and slug in (${SEED_SLUGS.map(slug => `'${slug}'`).join(', ')});`))).toBe(6)
    for (const slug of SEED_SLUGS) {
      expect(Number(sql(`select count(*) from public.persons where slug = '${slug}';`))).toBe(1)
      expect(Number(sql(`
        select count(*) from public.person_sources ps
        join public.persons p on p.id = ps.person_id
        where p.slug = '${slug}';
      `))).toBeGreaterThanOrEqual(1)
    }
    expect(Number(sql(`
      select count(*) from public.person_areas pa
      join public.persons p on p.id = pa.person_id
      join public.areas a on a.id = pa.area_id;
    `))).toBeGreaterThanOrEqual(6)
    expect(Number(sql(`
      select count(*) from public.person_heritage_items phi
      join public.persons p on p.id = phi.person_id
      join public.heritage_items i on i.id = phi.item_id;
    `))).toBe(2)
  })

  it('fails when a settlement slug in the seed is missing', () => {
    const broken = readFileSync(new URL('../supabase/migrations/20261104050000_seed_persons.sql', import.meta.url), 'utf8')
      .replace(`slug = 'miholec'`, `slug = 'nema-takvog-naselja-wp19'`)
    expect(() => sql(broken)).toThrow()
  })
})
