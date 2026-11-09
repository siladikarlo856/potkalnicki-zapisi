import type { SupabaseClient } from '@supabase/supabase-js'
import { validateHeritageItem } from '../../../../shared/utils/content/heritageItem'
import type { HeritageImageValue, ImageLicense } from '../../../../shared/utils/content/heritageImage'
import { defineContentKind } from '../definition'
import { missingSourceIssues } from '../linkCheck'
import { intangibleReferences } from './intangible'

async function loadSourceIds(db: SupabaseClient, itemId: string) {
  const { data, error } = await db.from('heritage_item_sources')
    .select('source_id,position').eq('item_id', itemId).order('position')
  if (error) throw error
  return (data ?? []).map(row => row.source_id as string)
}

async function loadImages(db: SupabaseClient, itemId: string): Promise<HeritageImageValue[]> {
  const { data, error } = await db.from('heritage_item_images')
    .select('path,thumb_path,width,height,alt,caption,author,author_url,source_url,license,position')
    .eq('item_id', itemId).order('position')
  if (error) throw error
  return (data ?? []).map(row => ({
    path: row.path as string,
    thumbPath: row.thumb_path as string,
    width: row.width as number,
    height: row.height as number,
    alt: row.alt as string,
    caption: row.caption as string | null,
    author: row.author as string,
    authorUrl: row.author_url as string | null,
    sourceUrl: row.source_url as string | null,
    license: row.license as ImageLicense
  }))
}

export const heritageItemKind = defineContentKind({
  kind: 'heritage_item',
  table: 'heritage_items',
  fields: {
    name: 'name',
    slug: 'slug',
    categoryId: 'category_id',
    municipalityId: 'municipality_id',
    settlementId: 'settlement_id',
    locality: 'locality',
    verification: 'verification',
    heritageStatus: 'heritage_status',
    registryNumber: 'registry_number',
    period: 'period',
    description: 'description',
    researchNotes: 'research_notes',
    latitude: 'latitude',
    longitude: 'longitude',
    noindex: 'noindex'
  // sourceIds and images live in heritage_item_sources and heritage_item_images (sidecars), not on the row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  labelColumn: 'name',
  createdFrom: 'source_submission_id',
  validate: validateHeritageItem,
  sorts: { name: 'name', verification: 'verification' },
  defaultSort: 'name',
  filters: {
    categoryId: { column: 'category_id', values: [] },
    municipalityId: { column: 'municipality_id', values: [] },
    verification: { column: 'verification', values: ['unverified', 'in_review', 'verified', 'needs_update'] }
  },
  uniqueConstraints: { heritage_items_settlement_slug: 'slug' },
  // Stories, customs and folk texts tied to the item (their link tables restrict its deletion).
  references: (db, id) => intangibleReferences(db, 'heritage_item', id),
  sidecars: {
    fields: ['sourceIds', 'images'],
    load: async (db, id) => ({ sourceIds: await loadSourceIds(db, id), images: await loadImages(db, id) })
  },
  checkLinks: async (db, value) => missingSourceIssues(db, value.sourceIds),
  // The heritage_items row, its sources and its photos in one transaction
  // (supabase/migrations/20261109000000_heritage_item_images.sql).
  persist: async (db, id, value, { row, revision }) => {
    const { data, error } = await db.rpc('content_heritage_item_save', {
      p_id: id, p_revision: revision ?? null, p_row: row, p_source_ids: value.sourceIds ?? [], p_images: value.images ?? []
    })
    if (error) throw error
    return (data as string | null) ?? null
  },
  // The settlement's slug and the category's label, for the admin list.
  async derive(db, values) {
    const settlementIds = [...new Set(values.map(value => value.settlementId).filter((id): id is string => typeof id === 'string'))]
    const categoryIds = [...new Set(values.map(value => value.categoryId).filter((id): id is string => typeof id === 'string'))]
    const settlements = new Map<string, string>()
    const categories = new Map<string, string>()
    if (settlementIds.length) {
      const { data, error } = await db.from('areas').select('id,slug').in('id', settlementIds)
      if (error) throw error
      for (const row of data ?? []) settlements.set(row.id as string, row.slug as string)
    }
    if (categoryIds.length) {
      const { data, error } = await db.from('heritage_categories').select('id,label_hr').in('id', categoryIds)
      if (error) throw error
      for (const row of data ?? []) categories.set(row.id as string, row.label_hr as string)
    }
    return values.map(value => ({
      ...value,
      settlementSlug: settlements.get(value.settlementId as string) ?? null,
      categoryLabel: categories.get(value.categoryId as string) ?? null
    }))
  }
})
