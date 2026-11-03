<script setup lang="ts">
import {
  AREA_KIND_LAU, AREA_KIND_LABELS, AREA_LIMITS, areaAdminLabel, areaKindNeedsSlug,
  validateArea, type Area, type AreaKind, type AreaValue
} from '~~/shared/utils/content/area'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Mjesta', robots: 'noindex, nofollow' })

type AreaForm = Omit<AreaValue, 'status'>

const TABS = [
  { key: 'naselja', label: 'Naselja', kind: 'settlement' as const },
  { key: 'gradovi', label: 'Gradovi i općine', kind: AREA_KIND_LAU },
  { key: 'regije', label: 'Regije', kind: 'region' as const },
  { key: 'zupanije', label: 'Županije', kind: 'county' as const },
  { key: 'drzave', label: 'Države', kind: 'country' as const }
] as const

const kindFilterOptions = [
  ...(['country', 'county', 'region', 'town', 'municipality', 'settlement'] as const).map(value => ({ label: AREA_KIND_LABELS[value], value })),
  { label: 'Gradovi i općine', value: AREA_KIND_LAU }
]

const route = useRoute()
const router = useRouter()

function defaultKindForTab(): AreaKind {
  const kind = typeof route.query.kind === 'string' ? route.query.kind : TABS[0].kind
  if (kind === AREA_KIND_LAU) return 'town'
  if ((['country', 'county', 'region', 'town', 'municipality', 'settlement'] as const).includes(kind as AreaKind)) {
    return kind as AreaKind
  }
  return 'settlement'
}

const resource = defineAdminResource<Area, AreaForm>({
  kind: 'area',
  icon: 'i-lucide-map-pin',
  labels: {
    title: 'Mjesta',
    description: 'Država, županija, regija, gradovi, općine i naselja — hijerarhija i članstvo u regiji Potkalničkog prigorja.',
    create: 'Novo mjesto',
    edit: 'Uredi mjesto',
    empty: 'Još nema mjesta ove vrste.',
    search: 'Pretraži mjesta'
  },
  columns: [
    { key: 'name', label: 'Naziv', sort: 'name' },
    { key: 'kind', label: 'Vrsta', sort: 'kind', hideBelow: 'md' },
    { key: 'slug', label: 'Slug', hideBelow: 'lg' },
    { key: 'parentId', label: 'Nadređeno', hideBelow: 'lg' }
  ],
  hiddenFilters: [{ key: 'kind', label: 'Vrsta', options: kindFilterOptions }],
  defaultSort: 'name',
  blank: () => ({
    kind: defaultKindForTab(),
    parentId: null,
    name: '',
    slug: null,
    officialCode: null,
    geonamesId: null,
    latitude: null,
    longitude: null,
    description: null,
    regionIds: []
  }),
  toForm: area => ({
    kind: area.kind,
    parentId: area.parentId,
    name: area.name,
    slug: area.slug,
    officialCode: area.officialCode,
    geonamesId: area.geonamesId,
    latitude: area.latitude,
    longitude: area.longitude,
    description: area.description,
    regionIds: area.regionIds ?? []
  }),
  validate: form => validateArea(form).issues,
  label: area => areaAdminLabel(area.kind, area.name),
  publicPath(area) {
    if (area.status !== 'published' || !area.slug) return undefined
    if (area.kind === 'settlement') return `/potkalnicko-prigorje/naselja/${area.slug}`
    if (area.kind === 'town' || area.kind === 'municipality' || area.kind === 'region') {
      return `/potkalnicko-prigorje/istrazi/${area.slug}`
    }
    return undefined
  }
})

const activeTab = computed(() => {
  const kind = typeof route.query.kind === 'string' ? route.query.kind : TABS[0].kind
  return TABS.find(tab => tab.kind === kind) ?? TABS[0]
})

function selectTab(key: typeof TABS[number]['key']) {
  const tab = TABS.find(entry => entry.key === key)!
  router.replace({ query: { ...route.query, kind: tab.kind, page: undefined } })
}

const treeView = computed({
  get: () => route.query.stablo === '1',
  set: (on: boolean) => router.replace({ query: { ...route.query, stablo: on ? '1' : undefined } })
})

watch(activeTab, (tab) => {
  if (route.query.kind === tab.kind) return
  router.replace({ query: { ...route.query, kind: tab.kind, page: undefined } })
}, { immediate: true })

const parentLabels = ref(new Map<string, string>())

onMounted(async () => {
  for (const kind of ['country', 'county', AREA_KIND_LAU] as const) {
    const result = await $fetch<{ rows: Area[] }>('/api/admin/content/area', { query: { kind, size: 100, sort: 'name' } })
    for (const row of result.rows) parentLabels.value.set(row.id, areaAdminLabel(row.kind, row.name))
  }
})

async function loadParentOptions(kind: AreaKind, q: string) {
  if (kind === 'country') return []
  const query: Record<string, string | number> = { q, size: 25, sort: 'name' }
  if (kind === 'county') query.kind = 'country'
  else if (kind === 'town' || kind === 'municipality') query.kind = 'county'
  else if (kind === 'settlement') query.kind = AREA_KIND_LAU
  const result = await $fetch<{ rows: Area[] }>('/api/admin/content/area', { query })
  return result.rows.map(row => ({ label: areaAdminLabel(row.kind, row.name), value: row.id }))
}

const { data: regionRows } = useFetch<{ rows: Area[] }>('/api/admin/content/area', {
  query: { kind: 'region', size: 100, sort: 'name' },
  server: false,
  key: 'admin-area-regions'
})
const regionOptions = computed(() => (regionRows.value?.rows ?? []).map(row => ({ label: row.name, value: row.id })))

function parentKindHint(kind: AreaKind) {
  switch (kind) {
    case 'country': return 'Država nema nadređeno mjesto.'
    case 'county': return 'Nadređeno mjesto mora biti država.'
    case 'region': return 'Nadređeno mjesto je država ili županija.'
    case 'town':
    case 'municipality': return 'Nadređeno mjesto mora biti županija.'
    case 'settlement': return 'Nadređeno mjesto mora biti grad ili općina.'
  }
}

const slugManual = ref(false)
</script>

<template>
  <AdminResourcePage :resource="resource">
    <template #toolbar>
      <div class="flex flex-col gap-3">
        <UTabs
          :items="TABS.map(tab => ({ label: tab.label, value: tab.key }))"
          :model-value="activeTab.key"
          @update:model-value="selectTab($event as typeof TABS[number]['key'])"
        />
        <USwitch
          v-model="treeView"
          label="Prikaz stabla (uvlačenje naselja)"
          :disabled="activeTab.key !== 'naselja'"
        />
      </div>
    </template>

    <template #name-cell="{ row }">
      <span :class="treeView && row.kind === 'settlement' ? 'ps-4' : undefined">
        {{ row.name }}
      </span>
    </template>
    <template #kind-cell="{ row }">
      {{ AREA_KIND_LABELS[row.kind] }}
    </template>
    <template #slug-cell="{ row }">
      <span class="font-mono text-xs">{{ row.slug ?? '—' }}</span>
    </template>
    <template #parentId-cell="{ row }">
      {{ row.parentId ? (parentLabels.get(row.parentId) ?? row.parentId) : '—' }}
    </template>

    <template #fields="{ state, entity }">
      <AreaAdminFields
        :form="state"
        :entity-id="entity?.id"
        :region-options="regionOptions"
        :load-parent-options="loadParentOptions"
        :parent-hint="parentKindHint(state.kind)"
      />
    </template>
    <template #advanced="{ state, entity }">
      <UFormField
        name="slug"
        label="Slug"
        :hint="areaKindNeedsSlug(state.kind, entity?.status ?? 'draft') ? 'Obavezno za objavu ove vrste' : 'Neobavezno'"
        description="Stara adresa preusmjerava na novu kad se slug promijeni."
      >
        <UInput
          :model-value="state.slug ?? undefined"
          @update:model-value="state.slug = ($event && String($event).trim()) ? String($event) : null"
          :maxlength="AREA_LIMITS.slug"
          class="w-full font-mono"
          placeholder="auto iz naziva"
          @input="slugManual = true"
        />
      </UFormField>
    </template>
  </AdminResourcePage>
</template>
