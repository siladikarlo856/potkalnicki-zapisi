<script setup lang="ts">
import { atlasSlug } from '~~/shared/utils/atlasSlug'
import type { ContentLookupItem } from '~~/shared/utils/content/common'
import {
  PERSON_AREA_ROLE_LABELS, PERSON_AREA_ROLES, PERSON_LIMITS, PERSON_VERIFICATION_LABELS, PERSON_VERIFICATIONS,
  type PersonAreaLink, type PersonAreaRole, type PersonItemLink, type PersonValue
} from '~~/shared/utils/content/person'

const props = defineProps<{
  state: PersonValue
  entityId?: string
}>()

const emit = defineEmits<{ 'update:state': [PersonValue] }>()

function patch(partial: Partial<PersonValue>) {
  emit('update:state', { ...props.state, ...partial })
}

function bind<K extends keyof PersonValue>(key: K) {
  return computed({
    get: () => props.state[key],
    set: (value: PersonValue[K]) => patch({ [key]: value } as Partial<PersonValue>)
  })
}

function bindNullableString<K extends keyof PersonValue>(key: K) {
  return computed({
    get: () => props.state[key] as string | null ?? '',
    set: (value: string) => patch({ [key]: (value || null) as PersonValue[K] })
  })
}

const name = bind('name')
const slug = bind('slug')
const role = bind('role')
const clue = bind('clue')
const verification = bind('verification')
const researchNotes = bind('researchNotes')
const sourceIds = bind('sourceIds')
const noindex = bind('noindex')
const born = bindNullableString('born')
const bornPlace = bindNullableString('bornPlace')
const died = bind('died')
const diedYear = bind('diedYear')
const bornYear = bind('bornYear')
const diedPlace = bindNullableString('diedPlace')
const bio = bindNullableString('bio')
const openQuestions = bindNullableString('openQuestions')

const verificationOptions = PERSON_VERIFICATIONS.map(value => ({ label: PERSON_VERIFICATION_LABELS[value], value }))
const areaRoleOptions = PERSON_AREA_ROLES.map(value => ({ label: PERSON_AREA_ROLE_LABELS[value], value }))

const slugManual = ref(false)
watch(() => props.state.name, (value) => {
  if (slugManual.value || props.entityId) return
  patch({ slug: atlasSlug(value) })
})
watch(() => props.state.slug, () => {
  slugManual.value = true
})

async function suggestSlug() {
  const base = props.state.slug || props.state.name
  if (!base) return
  const query: Record<string, string> = { base }
  if (props.entityId) query.exclude = props.entityId
  const result = await $fetch<{ slug: string }>(`/api/admin/content/person/slug`, { query })
  patch({ slug: result.slug })
  slugManual.value = true
}

const areaSearch = ref('')
const itemSearch = ref('')
const sourceSearch = ref('')

const areaQuery = computed(() => ({
  scope: 'settlement',
  q: areaSearch.value.trim() || undefined,
  ids: props.state.areaLinks.map(link => link.areaId).filter(Boolean).join(',') || undefined
}))
const { data: areaLookup } = useFetch<{ items: ContentLookupItem[] }>('/api/admin/lookup/area', {
  query: areaQuery,
  server: false
})
const areaItems = computed(() => (areaLookup.value?.items ?? []).map(item => ({ label: item.label, value: item.id })))

const itemQuery = computed(() => ({
  q: itemSearch.value.trim() || undefined,
  ids: props.state.itemLinks.map(link => link.itemId).filter(Boolean).join(',') || undefined
}))
const { data: itemLookup } = useFetch<{ items: ContentLookupItem[] }>('/api/admin/lookup/heritage_item', {
  query: itemQuery,
  server: false
})
const itemItems = computed(() => (itemLookup.value?.items ?? []).map(item => ({ label: item.label, value: item.id })))

const sourceQuery = computed(() => ({
  q: sourceSearch.value.trim() || undefined,
  ids: props.state.sourceIds.length && !sourceSearch.value ? props.state.sourceIds.join(',') : undefined
}))
const { data: sourceLookup } = useFetch<{ items: ContentLookupItem[] }>('/api/admin/lookup/source', {
  query: sourceQuery,
  server: false
})
const sourceItems = computed(() => (sourceLookup.value?.items ?? []).map(item => ({ label: item.label, value: item.id })))

const areaLinks = computed({
  get: () => props.state.areaLinks,
  set: (value: PersonAreaLink[]) => patch({ areaLinks: value })
})

const itemLinks = computed({
  get: () => props.state.itemLinks,
  set: (value: PersonItemLink[]) => patch({ itemLinks: value })
})

function addAreaLink() {
  if (areaLinks.value.length >= 12) return
  areaLinks.value = [...areaLinks.value, { areaId: '', role: 'djelovao' }]
}

function updateAreaLink(index: number, partial: Partial<PersonAreaLink>) {
  const next = [...areaLinks.value]
  next[index] = { ...next[index]!, ...partial }
  areaLinks.value = next
}

function removeAreaLink(index: number) {
  areaLinks.value = areaLinks.value.filter((_, i) => i !== index)
}

function addItemLink() {
  if (itemLinks.value.length >= 12) return
  itemLinks.value = [...itemLinks.value, { itemId: '', relation: '' }]
}

function updateItemLink(index: number, partial: Partial<PersonItemLink>) {
  const next = [...itemLinks.value]
  next[index] = { ...next[index]!, ...partial }
  itemLinks.value = next
}

function removeItemLink(index: number) {
  itemLinks.value = itemLinks.value.filter((_, i) => i !== index)
}
</script>

<template>
  <h3 class="text-sm font-semibold text-highlighted">
    Osnovno
  </h3>
  <UFormField
    name="name"
    label="Ime"
    required
  >
    <UInput
      v-model="name"
      :maxlength="PERSON_LIMITS.name"
      class="w-full"
      autofocus
    />
  </UFormField>
  <UFormField
    name="role"
    label="Uloga (jedan red)"
  >
    <UInput
      v-model="role"
      :maxlength="PERSON_LIMITS.role"
      class="w-full"
    />
  </UFormField>
  <UFormField
    name="clue"
    label="Natuknica (prednja strana kartice)"
    hint="Ne smije sadržavati ime osobe."
  >
    <UTextarea
      v-model="clue"
      :maxlength="PERSON_LIMITS.clue"
      :rows="2"
      autoresize
      class="w-full"
    />
  </UFormField>
  <UFormField
    name="verification"
    label="Status provjere"
    required
  >
    <USelect
      v-model="verification"
      :items="verificationOptions"
      class="w-full"
    />
  </UFormField>
  <UFormField
    name="slug"
    label="Slug"
    required
  >
    <div class="flex gap-2">
      <UInput
        v-model="slug"
        :maxlength="PERSON_LIMITS.slug"
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
  </UFormField>

  <h3 class="pt-2 text-sm font-semibold text-highlighted">
    Životni podaci
  </h3>
  <div class="grid gap-4 sm:grid-cols-2">
    <UFormField
      name="born"
      label="Rođen/a (prikaz)"
    >
      <UInput
        v-model="born"
        :maxlength="PERSON_LIMITS.born"
        class="w-full"
      />
    </UFormField>
    <UFormField
      name="bornYear"
      label="Godina rođenja"
    >
      <UInput
        v-model="bornYear"
        type="number"
        class="w-full"
      />
    </UFormField>
  </div>
  <UFormField
    name="bornPlace"
    label="Mjesto rođenja (slobodan tekst)"
  >
    <UInput
      v-model="bornPlace"
      :maxlength="PERSON_LIMITS.bornPlace"
      class="w-full"
    />
  </UFormField>
  <div class="grid gap-4 sm:grid-cols-2">
    <UFormField
      name="died"
      label="Smrt (prikaz)"
      required
    >
      <UInput
        v-model="died"
        :maxlength="PERSON_LIMITS.died"
        class="w-full"
      />
    </UFormField>
    <UFormField
      name="diedYear"
      label="Godina smrti"
      required
    >
      <UInput
        v-model="diedYear"
        type="number"
        class="w-full"
      />
    </UFormField>
  </div>
  <UFormField
    name="diedPlace"
    label="Mjesto smrti (slobodan tekst)"
  >
    <UInput
      v-model="diedPlace"
      :maxlength="PERSON_LIMITS.diedPlace"
      class="w-full"
    />
  </UFormField>
  <UFormField
    name="bio"
    label="Biografija"
  >
    <UTextarea
      v-model="bio"
      :maxlength="PERSON_LIMITS.bio"
      :rows="4"
      autoresize
      class="w-full"
    />
  </UFormField>

  <h3 class="pt-2 text-sm font-semibold text-highlighted">
    Mjesta
  </h3>
  <div class="flex flex-col gap-3">
    <div
      v-for="(link, index) in areaLinks"
      :key="index"
      class="grid gap-2 sm:grid-cols-[1fr_auto_auto]"
    >
      <USelectMenu
        v-model:search-term="areaSearch"
        :model-value="link.areaId || undefined"
        :items="areaItems"
        value-key="value"
        placeholder="Naselje ili općina"
        class="w-full"
        @update:model-value="updateAreaLink(index, { areaId: $event ?? '' })"
      />
      <USelect
        :model-value="link.role"
        :items="areaRoleOptions"
        class="w-full min-w-40"
        @update:model-value="updateAreaLink(index, { role: $event as PersonAreaRole })"
      />
      <UButton
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        type="button"
        aria-label="Ukloni vezu"
        @click="removeAreaLink(index)"
      />
    </div>
    <UButton
      label="Dodaj mjesto"
      icon="i-lucide-plus"
      color="neutral"
      variant="outline"
      type="button"
      @click="addAreaLink"
    />
  </div>

  <h3 class="pt-2 text-sm font-semibold text-highlighted">
    Baština
  </h3>
  <div class="flex flex-col gap-3">
    <div
      v-for="(link, index) in itemLinks"
      :key="index"
      class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
    >
      <USelectMenu
        v-model:search-term="itemSearch"
        :model-value="link.itemId || undefined"
        :items="itemItems"
        value-key="value"
        placeholder="Zapis baštine"
        class="w-full"
        @update:model-value="updateItemLink(index, { itemId: $event ?? '' })"
      />
      <UInput
        :model-value="link.relation"
        :maxlength="PERSON_LIMITS.relation"
        placeholder="Odnos"
        class="w-full"
        @update:model-value="updateItemLink(index, { relation: String($event) })"
      />
      <UButton
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        type="button"
        aria-label="Ukloni vezu"
        @click="removeItemLink(index)"
      />
    </div>
    <UButton
      label="Dodaj zapis baštine"
      icon="i-lucide-plus"
      color="neutral"
      variant="outline"
      type="button"
      @click="addItemLink"
    />
  </div>

  <h3 class="pt-2 text-sm font-semibold text-highlighted">
    Izvori
  </h3>
  <UFormField
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
  </UFormField>

  <h3 class="pt-2 text-sm font-semibold text-highlighted">
    Bilješke
  </h3>
  <UFormField
    name="openQuestions"
    label="Što još provjeravamo"
  >
    <UTextarea
      v-model="openQuestions"
      :maxlength="PERSON_LIMITS.openQuestions"
      :rows="2"
      autoresize
      class="w-full"
    />
  </UFormField>
  <UFormField
    name="researchNotes"
    label="Bilješke istraživanja (privatno)"
  >
    <UTextarea
      v-model="researchNotes"
      :maxlength="PERSON_LIMITS.researchNotes"
      :rows="4"
      autoresize
      class="w-full"
    />
  </UFormField>
  <UFormField name="noindex">
    <UCheckbox
      v-model="noindex"
      label="Ne indeksirati u tražilicama (noindex)"
    />
  </UFormField>
</template>
