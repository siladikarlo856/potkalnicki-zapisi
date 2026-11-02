import { readdirSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HERITAGE_CATEGORY_LABELS } from '../shared/utils/atlasData'
import { buildContentRows, buildContentSeed, contentUuid, seedMigrationPath } from '../scripts/generate-content-seed.mjs'

// Drift guard for the one-time atlas import. The committed seed migration must be exactly what the generator
// renders from the content files. If this fails because a content file changed: the import has already been
// applied, so do not regenerate it; make the change in the database instead (later through the admin).
// Regenerate only while the seed migration is unmerged: `node scripts/generate-content-seed.mjs`.
const migrations = readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter(f => f.endsWith('.sql')).sort()
const path = seedMigrationPath()
const sql = readFileSync(path, 'utf8')
const rows = buildContentRows()

describe('atlas content seed migration', () => {
  it('is exactly what the generator renders from the content files', () => {
    expect(sql).toBe(buildContentSeed())
  })

  it('runs after the content tables it fills, as one transaction with the import actor', () => {
    const name = basename(path)
    expect(migrations.filter(f => f.endsWith('_seed_content.sql'))).toEqual([name])
    expect(migrations.indexOf(name)).toBeGreaterThan(migrations.findIndex(f => f.endsWith('_content_tables.sql')))
    expect(sql).toMatch(/^begin;\n\nset local app\.actor = 'import';\n/m)
    expect(sql.trimEnd().endsWith('\ncommit;')).toBe(true)
    // Additive and replayable: nothing but inserts that leave existing rows alone.
    const statements = sql.split('\n').filter(line => line && !line.startsWith('--') && !['begin;', 'commit;', 'set local app.actor = \'import\';'].includes(line))
    expect(statements.every(line => /^insert into public\.[a-z_]+ \(.+\) on conflict \([a-z_, ]+\) do nothing;$/.test(line))).toBe(true)
  })

  it('imports the whole atlas: 143 areas, 10 categories, 10 sources and 107 items', () => {
    const kinds = rows.areas.reduce<Record<string, number>>((n, a) => ({ ...n, [a.kind as string]: (n[a.kind as string] ?? 0) + 1 }), {})
    expect(kinds).toEqual({ country: 1, county: 1, region: 1, town: 1, municipality: 4, settlement: 135 })
    expect(rows.regionMembers).toHaveLength(5)
    expect(rows.categories).toHaveLength(10)
    expect(rows.sources).toHaveLength(10)
    expect(rows.items).toHaveLength(107)
    expect(rows.itemSources).toHaveLength(137)
    expect(rows.areas.every(a => a.status === 'published')).toBe(true)
    expect(rows.items.every(i => i.status === 'published')).toBe(true)
  })

  it('imports the category labels the atlas shows today, in order', () => {
    expect(rows.categories.map(c => [c.key, c.label_hr])).toEqual(Object.entries(HERITAGE_CATEGORY_LABELS))
  })

  it('carries the dataset fields the atlas import dropped', () => {
    expect(rows.items.filter(i => i.period !== null)).toHaveLength(7)
    expect(rows.items.filter(i => i.registry_number !== null)).toHaveLength(19)
    expect(rows.items.filter(i => i.heritage_status === 'needs_verification')).toHaveLength(100)
    expect(rows.items.filter(i => i.heritage_status === 'historical_site')).toHaveLength(7)
    expect(rows.items.find(i => i.dataset_id === 'apatovec-crkva-sv-petra')).toMatchObject({ registry_number: 'Z-1781', heritage_status: 'needs_verification' })
  })

  it('uses deterministic ids and one entity per legacy id', () => {
    // Same vectors as the SQL content_uuid test in test/content.integration.test.ts.
    expect(contentUuid('area:krizevci')).toBe('92140ed6-6420-81d0-8661-91ce0c257f5f')
    expect(contentUuid('heritage_item:krizevci-crkva-sv-ane')).toBe('8ca54414-a168-80b7-bc80-619d7c36827a')
    expect(rows.areas.find(a => a.slug === 'grad-krizevci')?.id).toBe(contentUuid('area:krizevci'))
    expect(rows.items.find(i => i.dataset_id === 'križevci-crkva-sv-ane')?.id).toBe(contentUuid('heritage_item:krizevci-crkva-sv-ane'))

    const ids = [...rows.areas, ...rows.categories, ...rows.sources, ...rows.items].map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    const legacy = rows.legacyIds.map(l => `${l.kind}:${l.legacy_id}`)
    expect(new Set(legacy).size).toBe(legacy.length)
    expect(rows.legacyIds.every(l => ids.includes(l.entity_id))).toBe(true)
    const resolve = (key: string) => rows.legacyIds.find(l => l.kind === 'area' && l.legacy_id === key)?.entity_id
    expect(resolve('hr-kkz-krizevci')).toBe(resolve('krizevci'))
    expect(resolve('hr-kkz-sveti-petar-orehovec')).toBe(resolve('svetiPetarOrehovec'))
  })

  it('keeps the public URLs: unique area slugs per namespace and item slugs per settlement', () => {
    const namespace = (kind: unknown) => kind === 'town' || kind === 'municipality' ? 'lau' : String(kind)
    const areaSlugs = rows.areas.filter(a => a.slug !== null).map(a => `${namespace(a.kind)}:${a.slug}`)
    expect(new Set(areaSlugs).size).toBe(areaSlugs.length)
    const itemSlugs = rows.items.filter(i => i.settlement_id !== null).map(i => `${i.settlement_id}:${i.slug}`)
    expect(new Set(itemSlugs).size).toBe(itemSlugs.length)
    // Every item's settlement sits under the item's municipality (the database checks this too).
    const parent = new Map(rows.areas.map(a => [a.id, a.parent_id]))
    for (const item of rows.items.filter(i => i.settlement_id !== null)) expect(parent.get(item.settlement_id)).toBe(item.municipality_id)
  })
})
