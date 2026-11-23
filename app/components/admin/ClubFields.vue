<script setup lang="ts">
import { atlasSlug } from '~~/shared/utils/atlasSlug'
import type { ContentLookupItem } from '~~/shared/utils/content/common'
import {
  CLUB_LIMITS, CLUB_VERIFICATION_LABELS, CLUB_VERIFICATIONS,
  type ClubSeasonValue, type ClubValue
} from '~~/shared/utils/content/club'

const $fetch = useEditorialFetch()

const props = defineProps<{
  state: ClubValue
  entityId?: string
}>()

const emit = defineEmits<{ 'update:state': [ClubValue] }>()

function patch(partial: Partial<ClubValue>) {
  emit('update:state', { ...props.state, ...partial })
}

function bind<K extends keyof ClubValue>(key: K) {
  return computed({
    get: () => props.state[key],
    set: (value: ClubValue[K]) => patch({ [key]: value } as Partial<ClubValue>)
  })
}

function bindNullableString<K extends keyof ClubValue>(key: K) {
  return computed({
    get: () => props.state[key] as string | null ?? '',
    set: (value: string) => patch({ [key]: (value || null) as ClubValue[K] })
  })
}

const name = bind('name')
const slug = bind('slug')
const fullName = bindNullableString('fullName')
const sport = bind('sport')
const settlementId = bind('settlementId')
const homeGround = bindNullableString('homeGround')
const researchNotes = bind('researchNotes')
const verification = bind('verification')
const sourceIds = bind('sourceIds')
const noindex = bind('noindex')

const verificationOptions = CLUB_VERIFICATIONS.map(value => ({ label: CLUB_VERIFICATION_LABELS[value], value }))

const slugManual = ref(false)
watch(() => props.state.name, (value) => {
  if (slugManual.value || props.entityId) return
  patch({ slug: atlasSlug(value) })
})

async function suggestSlug() {
  const base = props.state.slug || props.state.name
  if (!base) return
  const query: Record<string, string> = { base }
  if (props.entityId) query.exclude = props.entityId
  const result = await $fetch<{ slug: string }>(`/api/admin/content/club/slug`, { query })
  patch({ slug: result.slug })
  slugManual.value = true
}

const settlementSearch = ref('')
const sourceSearch = ref('')
const settlementQuery = computed(() => ({
  scope: 'settlement',
  q: settlementSearch.value.trim() || undefined,
  ids: props.state.settlementId || undefined
}))
const { data: settlementLookup } = useFetch<{ items: ContentLookupItem[] }>('/api/admin/lookup/area', {
  $fetch,
  query: settlementQuery,
  server: false
})
const settlementItems = computed(() => (settlementLookup.value?.items ?? []).map(item => ({ label: item.label, value: item.id })))

const sourceQuery = computed(() => ({
  q: sourceSearch.value.trim() || undefined,
  ids: props.state.sourceIds.length && !sourceSearch.value ? props.state.sourceIds.join(',') : undefined
}))
const { data: sourceLookup } = useFetch<{ items: ContentLookupItem[] }>('/api/admin/lookup/source', {
  $fetch,
  query: sourceQuery,
  server: false
})
const sourceItems = computed(() => (sourceLookup.value?.items ?? []).map(item => ({ label: item.label, value: item.id })))

function addSeason() {
  patch({ seasons: [...props.state.seasons, { season: '2026/27', competition: '', team: 'seniori', sourceUrl: null, checkedAt: new Date().toISOString().slice(0, 10) }] })
}

function updateSeason(index: number, partial: Partial<ClubSeasonValue>) {
  patch({ seasons: props.state.seasons.map((row, i) => i === index ? { ...row, ...partial } : row) })
}

function removeSeason(index: number) {
  patch({ seasons: props.state.seasons.filter((_, i) => i !== index) })
}
</script>

<template>
  <h3 class="text-sm font-semibold text-highlighted">
    Osnovno
  </h3>
  <AdminFormField
    name="name"
    label="Ime"
    required
  >
    <UInput
      v-model="name"
      :maxlength="CLUB_LIMITS.name"
      class="w-full"
      autofocus
    />
  </AdminFormField>
  <AdminFormField
    name="sport"
    label="Sport"
    required
  >
    <UInput
      v-model="sport"
      :maxlength="CLUB_LIMITS.sport"
      class="w-full"
    />
  </AdminFormField>
  <AdminFormField
    name="verification"
    label="Status provjere"
    required
  >
    <USelect
      v-model="verification"
      :items="verificationOptions"
      class="w-full"
    />
  </AdminFormField>
  <AdminFormField
    name="slug"
    label="Slug"
    required
  >
    <div class="flex gap-2">
      <UInput
        v-model="slug"
        :maxlength="CLUB_LIMITS.slug"
        class="w-full font-mono text-sm"
        @input="slugManual = true"
      />
      <UButton
        label="Predloži"
        color="neutral"
        variant="outline"
        type="button"
        @click="suggestSlug"
      />
    </div>
  </AdminFormField>
  <AdminFormField
    name="fullName"
    label="Puni naziv"
  >
    <UInput
      v-model="fullName"
      :maxlength="CLUB_LIMITS.fullName"
      class="w-full"
    />
  </AdminFormField>
  <AdminFormField
    name="settlementId"
    label="Naselje"
    required
  >
    <USelectMenu
      v-model="settlementId"
      v-model:search-term="settlementSearch"
      :items="settlementItems"
      value-key="value"
      searchable
      placeholder="Pretraži naselja"
      class="w-full"
    />
  </AdminFormField>
  <AdminFormField
    name="foundedYear"
    label="Godina osnivanja"
  >
    <UInput
      :model-value="state.foundedYear != null ? String(state.foundedYear) : undefined"
      type="number"
      class="w-full"
      @update:model-value="(raw) => { const n = Number(raw); patch({ foundedYear: raw === '' || raw === undefined || !Number.isFinite(n) ? null : n }) }"
    />
  </AdminFormField>
  <AdminFormField
    name="homeGround"
    label="Domaći teren"
  >
    <UInput
      v-model="homeGround"
      :maxlength="CLUB_LIMITS.homeGround"
      class="w-full"
    />
  </AdminFormField>

  <h3 class="pt-2 text-sm font-semibold text-highlighted">
    Sezone i lige
  </h3>
  <p class="text-sm text-muted">
    U karticama i kvizovima uvijek navodite sezonu (npr. 2026./27.). Podatke osvježavajte svaki kolovoz.
  </p>
  <div
    v-for="(season, index) in state.seasons"
    :key="index"
    class="my-3 space-y-2 rounded-lg border border-default p-3"
  >
    <AdminFormField label="Sezona">
      <UInput
        :model-value="season.season"
        placeholder="2026/27"
        @update:model-value="updateSeason(index, { season: String($event) })"
      />
    </AdminFormField>
    <AdminFormField label="Natjecanje">
      <UInput
        :model-value="season.competition"
        @update:model-value="updateSeason(index, { competition: String($event) })"
      />
    </AdminFormField>
    <AdminFormField label="Ekipa">
      <UInput
        :model-value="season.team"
        @update:model-value="updateSeason(index, { team: String($event) })"
      />
    </AdminFormField>
    <AdminFormField label="Izvor (URL)">
      <UInput
        :model-value="season.sourceUrl ?? ''"
        @update:model-value="updateSeason(index, { sourceUrl: String($event) || null })"
      />
    </AdminFormField>
    <AdminFormField label="Provjereno">
      <UInput
        type="date"
        :model-value="season.checkedAt"
        @update:model-value="updateSeason(index, { checkedAt: String($event) })"
      />
    </AdminFormField>
    <UButton
      label="Ukloni sezonu"
      color="error"
      variant="ghost"
      size="sm"
      type="button"
      @click="removeSeason(index)"
    />
  </div>
  <UButton
    label="Dodaj sezonu"
    icon="i-lucide-plus"
    color="neutral"
    variant="outline"
    type="button"
    @click="addSeason"
  />

  <h3 class="pt-2 text-sm font-semibold text-highlighted">
    Izvori
  </h3>
  <AdminFormField
    name="sourceIds"
    label="Izvori"
    description="Objava zahtijeva barem jedan izvor."
  >
    <USelectMenu
      v-model="sourceIds"
      v-model:search-term="sourceSearch"
      :items="sourceItems"
      value-key="value"
      multiple
      placeholder="Pretraži izvore"
      class="w-full"
    />
  </AdminFormField>

  <h3 class="pt-2 text-sm font-semibold text-highlighted">
    Bilješke
  </h3>
  <AdminFormField
    name="researchNotes"
    label="Bilješke istraživanja (privatno)"
  >
    <UTextarea
      v-model="researchNotes"
      :maxlength="CLUB_LIMITS.researchNotes"
      :rows="4"
      autoresize
      class="w-full"
    />
  </AdminFormField>
  <AdminFormField name="noindex">
    <UCheckbox
      v-model="noindex"
      label="Ne indeksirati u igrama (noindex)"
    />
  </AdminFormField>
</template>
