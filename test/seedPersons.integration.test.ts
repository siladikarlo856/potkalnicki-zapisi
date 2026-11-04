import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const container = process.env.TEST_CHALLENGE_CONTAINER ?? ''

function sql(input: string) {
  if (!/^ksh-challenge-test-[a-f0-9]+$/.test(container)) throw new Error('Refusing non-isolated database')
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}

const SEED_SLUGS = [
  'marko-krizevcanin',
  'ivan-vitez-od-sredne',
  'antun-nemcic',
  'sidonija-erdody-rubido',
  'vladimir-srecko-vrkljan',
  'zlatko-spoljar'
]

describe.skipIf(!process.env.TEST_CHALLENGE_API_URL)('persons seed on Postgres', () => {
  it('replays idempotently with six persons, sources and resolved links', () => {
    const seed = readFileSync(new URL('../supabase/migrations/20261104050000_seed_persons.sql', import.meta.url), 'utf8')
    sql(seed)
    sql(seed)
    expect(Number(sql('select count(*) from public.persons where status = \'published\';'))).toBe(6)
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
