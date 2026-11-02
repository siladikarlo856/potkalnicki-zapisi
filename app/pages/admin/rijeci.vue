<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AdminWord, WordInput } from '~~/shared/utils/word'
import { validateWord } from '~~/shared/utils/word'
import { dailyReadiness } from '~~/shared/utils/dailyWord'
import baseAreas from '~~/content/heritage/areas.json'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
useSeoMeta({ title: 'Upravljanje riječima', robots: 'noindex, nofollow' })

const words = ref<AdminWord[]>([])
const editor = ref<WordInput>()
const editorVersion = ref(0)
const editingId = ref<string>()
const busy = ref(false)
const loading = ref(false)
const error = ref('')
const notice = ref('')
const offset = ref(0)
const more = ref(false)
const filter = ref('all')
const search = ref('')
const expanded = ref<Record<string, boolean>>({})
const sidebarId = ref<string>()
const sidebarWord = computed(() => words.value.find(w => w.entry.id === sidebarId.value))
const sidebarOpen = computed({
  get: () => !!sidebarWord.value,
  set: (open) => { if (!open) sidebarId.value = undefined }
})
const editorHeading = useTemplateRef<HTMLElement>('editorHeading')
const daily = useTemplateRef<{ refresh: () => Promise<void> }>('daily')
const pinRequest = ref<{ wordId: string, nonce: number }>()
const readinessPool = ref<WordInput['entry'][]>([])
const READINESS_LABELS = { example: 'primjer', category: 'kategorija', distractors: 'netočni odgovori' } as const
function readiness(word: AdminWord) {
  const result = dailyReadiness(word.entry, readinessPool.value)
  return {
    label: result.ready ? 'Riječ dana: spremno' : `Riječ dana: nedostaje ${result.missing.map(m => READINESS_LABELS[m]).join(', ')}`,
    color: result.ready ? 'success' as const : 'warning' as const
  }
}
const columns: TableColumn<AdminWord>[] = [
  { id: 'info', meta: { class: { th: 'w-12', td: 'w-12' } } },
  { id: 'headword', header: 'Riječ' },
  { id: 'state', header: 'Stanje' },
  { id: 'meaning', header: 'Značenje', meta: { class: { th: 'hidden md:table-cell', td: 'hidden md:table-cell max-w-xs truncate' } } }
]
const visible = computed(() => words.value.filter(w => (filter.value === 'all' || w.active === (filter.value === 'active'))
  && `${w.entry.headword} ${w.entry.meaning.hr} ${w.entry.meaning.en ?? ''}`.toLocaleLowerCase('hr').includes(search.value.toLocaleLowerCase('hr'))))

function fail(err: unknown) {
  const e = err as { statusCode?: number, data?: { data?: { issues?: string[] } } }
  if (e.statusCode === 401) {
    navigateTo('/admin/prijava')
    error.value = 'Pogrešna lozinka.'
    return
  }
  error.value = e.data?.data?.issues?.join(' · ')
    || (e.statusCode === 503 ? 'Baza ili pregled nisu konfigurirani.' : e.statusCode === 429 ? 'Previše pokušaja. Pokušaj poslije.' : 'Radnja nije uspjela. Pokušaj opet.')
}
function api<T>(path: string, method: 'GET' | 'POST' | 'PUT' = 'GET', body?: WordInput) {
  return $fetch<T>(path, { method, body })
}
async function load(append = false) {
  loading.value = true
  error.value = ''
  try {
    const nextOffset = append ? offset.value + 50 : 0
    const page = await api<AdminWord[]>(`/api/review/words?offset=${nextOffset}`)
    if (!append) {
      const pool = page.filter(w => w.active).map(w => w.entry)
      try {
        let poolOffset = 50
        while (page.length === 50) {
          const next = await api<AdminWord[]>(`/api/review/words?offset=${poolOffset}`)
          pool.push(...next.filter(w => w.active).map(w => w.entry))
          if (next.length < 50) break
          poolOffset += 50
        }
      } catch {
        // Table still loads; keep partial pool so badges degrade instead of blocking the list.
      }
      readinessPool.value = pool
    }
    words.value = append ? [...words.value, ...page] : page
    offset.value = nextOffset
    more.value = page.length === 50
  } catch (err) {
    fail(err)
  } finally {
    loading.value = false
  }
}
async function focusEditor() {
  await nextTick()
  editorHeading.value?.focus()
}
function editFromSidebar(word: AdminWord) {
  sidebarId.value = undefined
  edit(word)
}
function edit(word: AdminWord) {
  expanded.value = { ...expanded.value, [word.entry.id]: true }
  editorVersion.value++
  editor.value = JSON.parse(JSON.stringify({ entry: word.entry, areas: word.areas, active: word.active }))
  editingId.value = word.entry.id
  error.value = ''
  focusEditor()
}
function pinFor(word: AdminWord) {
  pinRequest.value = { wordId: word.entry.id, nonce: (pinRequest.value?.nonce ?? 0) + 1 }
  document.getElementById('rijec-dana')?.scrollIntoView({ block: 'start' })
}
function create() {
  editorVersion.value++
  const id = crypto.randomUUID()
  editor.value = validateWord({ entry: { headword: '', meaning: { hr: '' }, status: 'community', sources: [], variants: [{ id: crypto.randomUUID(), form: '', status: 'community', usages: [] }] }, areas: baseAreas, active: false }, id).value
  editingId.value = undefined
  error.value = ''
  notice.value = ''
  focusEditor()
}
async function save(active: boolean) {
  if (!editor.value || busy.value) return
  const parsed = validateWord({ ...editor.value, active }, editingId.value ?? editor.value.entry.id)
  if (parsed.issues.length) {
    error.value = parsed.issues.join(' · ')
    return
  }
  busy.value = true
  error.value = ''
  try {
    await api<AdminWord>(editingId.value ? `/api/review/words/${editingId.value}` : '/api/review/words', editingId.value ? 'PUT' : 'POST', parsed.value)
    editor.value = undefined
    void daily.value?.refresh()
    notice.value = active ? 'Riječ je aktivna. Povezana prijava označena je kao odobrena. Javne kartice osvježavaju se unutar 30 sekundi.' : 'Neaktivna skica je spremljena. Ne prikazuje se u igri.'
    await load()
  } catch (err) {
    fail(err)
  } finally {
    busy.value = false
  }
}
async function toggle(word: AdminWord) {
  busy.value = true
  error.value = ''
  try {
    await api(`/api/review/words/${word.entry.id}`, 'PUT', { entry: word.entry, areas: word.areas, active: !word.active })
    // Activation changes what the schedule can use.
    void daily.value?.refresh()
    notice.value = word.active ? 'Riječ je deaktivirana. Javne kartice osvježavaju se unutar 30 sekundi.' : 'Riječ je aktivirana; povezana prijava je odobrena.'
    await load()
  } catch (err) {
    fail(err)
  } finally {
    busy.value = false
  }
}
// Collapsing the row that is being edited discards its unsaved form.
watch(expanded, (open) => {
  if (editingId.value && !open[editingId.value]) editor.value = undefined
})
onMounted(async () => {
  await load()
  if (typeof route.query.edit === 'string') {
    // Load additional pages when coming from a promotion of an existing older word.
    while (!words.value.some(w => w.entry.id === route.query.edit) && more.value && !error.value) await load(true)
    const word = words.value.find(w => w.entry.id === route.query.edit)
    if (word) edit(word)
  }
})
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <div
      class="mx-auto flex max-w-5xl flex-col gap-6"
      lang="hr"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-3xl font-bold tracking-tight text-highlighted">
            Upravljanje riječima
          </h1>
          <p class="mt-2 text-muted">
            Skice, izvori i aktivne kartice na jednom mjestu.
          </p>
        </div>
        <UButton
          to="/admin/prilozi"
          label="Prijave"
          icon="i-lucide-inbox"
          color="neutral"
          variant="outline"
        />
      </div>
      <UAlert
        v-if="error"
        :title="error"
        color="error"
        variant="subtle"
        role="alert"
      />
      <UAlert
        v-if="notice"
        :title="notice"
        color="success"
        variant="subtle"
        role="status"
      />
      <div class="flex flex-wrap gap-2">
        <UButton
          label="Nova riječ"
          icon="i-lucide-plus"
          :disabled="busy"
          @click="create"
        />
        <UButton
          label="Osvježi"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="subtle"
          :loading="loading"
          :disabled="busy"
          @click="load()"
        />
      </div>
      <HeritageDailyAdmin
        ref="daily"
        :words="words"
        :request="pinRequest"
      />
      <UCard v-if="editor && !editingId">
        <template #header>
          <h2
            ref="editorHeading"
            tabindex="-1"
            class="text-xl font-semibold text-highlighted"
          >
            Nova riječ · {{ editor.active ? 'aktivna' : 'neaktivna skica' }}
          </h2>
        </template>
        <HeritageWordEditor
          :key="editorVersion"
          v-model="editor"
          :busy="busy"
          @save="save"
          @cancel="editor = undefined"
        />
      </UCard>
      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField label="Pretraži učitane riječi">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Prikaži">
          <USelect
            v-model="filter"
            :items="[{ label: 'Sve riječi', value: 'all' }, { label: 'Aktivne', value: 'active' }, { label: 'Neaktivne skice', value: 'inactive' }]"
            class="w-full"
          />
        </UFormField>
      </div>
      <p class="text-sm text-muted">
        Učitano: {{ words.length }} · Prikazano: {{ visible.length }}. Deaktivacija čuva riječ i izvore; ništa se ne objavljuje samim dodavanjem iz prijave.
      </p>
      <p
        v-if="!visible.length && !loading"
        class="text-muted"
      >
        Nema riječi za ovaj prikaz.
      </p>
      <UTable
        v-model:expanded="expanded"
        :data="visible"
        :columns="columns"
        :loading="loading"
        :get-row-id="row => row.entry.id"
        caption="Riječi"
        class="rounded-lg ring ring-default"
        @select="(_event, row) => sidebarId = row.original.entry.id"
      >
        <template #info-cell="{ row }">
          <UButton
            icon="i-lucide-info"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="`Detalji: ${row.original.entry.headword || 'bez naslovne riječi'}`"
            :aria-expanded="row.getIsExpanded()"
            @click="row.toggleExpanded()"
          />
        </template>
        <template #headword-cell="{ row }">
          <span class="font-semibold text-highlighted">{{ row.original.entry.headword || '(bez naslovne riječi)' }}</span>
        </template>
        <template #state-cell="{ row }">
          <div class="flex flex-wrap gap-2">
            <UBadge
              :label="row.original.active ? 'Aktivna' : 'Neaktivna skica'"
              :color="row.original.active ? 'success' : 'neutral'"
              variant="subtle"
            /><UBadge
              :label="row.original.entry.status === 'placeholder' ? 'Uzorak · placeholder' : row.original.entry.status"
              color="neutral"
              variant="outline"
            /><UBadge
              :label="readiness(row.original).label"
              :color="readiness(row.original).color"
              variant="subtle"
            />
          </div>
        </template>
        <template #meaning-cell="{ row }">
          {{ row.original.entry.meaning.hr }}
        </template>
        <template #expanded="{ row }">
          <div class="flex flex-col gap-4 py-2 whitespace-normal">
            <template v-if="editor && editingId === row.original.entry.id">
              <h2
                ref="editorHeading"
                tabindex="-1"
                class="text-xl font-semibold text-highlighted"
              >
                Uredi riječ · {{ editor.active ? 'aktivna' : 'neaktivna skica' }}
              </h2>
              <HeritageWordEditor
                :key="editorVersion"
                v-model="editor"
                :busy="busy"
                @save="save"
                @cancel="editor = undefined"
              />
            </template>
            <template v-else>
              <HeritageWordDetails :word="row.original" />
              <div class="flex flex-wrap gap-2">
                <UButton
                  label="Uredi"
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="outline"
                  :disabled="busy"
                  @click="edit(row.original)"
                />
                <UButton
                  :label="row.original.active ? 'Deaktiviraj' : 'Aktiviraj'"
                  :icon="row.original.active ? 'i-lucide-pause' : 'i-lucide-check'"
                  color="neutral"
                  variant="subtle"
                  :disabled="busy"
                  @click="toggle(row.original)"
                />
                <UButton
                  label="Prikvači za datum"
                  icon="i-lucide-pin"
                  color="neutral"
                  variant="subtle"
                  :disabled="busy || !row.original.active"
                  :title="row.original.active ? undefined : 'Prikvačiti se mogu samo aktivne riječi.'"
                  @click="pinFor(row.original)"
                />
              </div>
            </template>
          </div>
        </template>
      </UTable>
      <UButton
        v-if="more"
        label="Učitaj još 50"
        color="neutral"
        variant="outline"
        :loading="loading"
        @click="load(true)"
      />
    </div>
    <USlideover
      v-model:open="sidebarOpen"
      side="right"
      :title="sidebarWord?.entry.headword || '(bez naslovne riječi)'"
      description="Pojedinosti riječi"
      :ui="{ content: 'w-full max-w-full sm:max-w-lg' }"
    >
      <template #body>
        <div
          v-if="sidebarWord"
          class="flex flex-col gap-4"
          lang="hr"
        >
          <div class="flex flex-wrap gap-2">
            <UBadge
              :label="sidebarWord.active ? 'Aktivna' : 'Neaktivna skica'"
              :color="sidebarWord.active ? 'success' : 'neutral'"
              variant="subtle"
            />
            <UBadge
              :label="sidebarWord.entry.status === 'placeholder' ? 'Uzorak · placeholder' : sidebarWord.entry.status"
              color="neutral"
              variant="outline"
            />
            <UBadge
              :label="readiness(sidebarWord).label"
              :color="readiness(sidebarWord).color"
              variant="subtle"
            />
          </div>
          <HeritageWordDetails :word="sidebarWord" />
          <div class="flex flex-wrap gap-2">
            <UButton
              label="Uredi"
              icon="i-lucide-pencil"
              color="neutral"
              variant="outline"
              :disabled="busy"
              @click="editFromSidebar(sidebarWord)"
            />
          </div>
        </div>
      </template>
    </USlideover>
  </UContainer>
</template>
