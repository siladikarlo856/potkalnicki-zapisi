<script setup lang="ts">
import { addDays } from '~~/shared/utils/dailyWord'
import { DAILY_PIN_HORIZON_DAYS } from '~~/shared/utils/dailyAdmin'
import type { DailyAdminDay, DailyAdminOverview, DailyPinResult } from '~~/shared/utils/dailyAdmin'
import type { Word } from '~~/shared/utils/content/word'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Riječ dana', robots: 'noindex, nofollow' })

const route = useRoute()
const confirm = useAdminConfirm()

const overview = ref<DailyAdminOverview>()
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const heading = useTemplateRef<HTMLElement>('heading')
const formOpen = ref(false)

const date = ref('')
const wordId = ref('')
const village = ref('auto')
const wordSearch = ref('')
const selectedWord = ref<Word | null>(null)

const minDate = computed(() => overview.value ? addDays(overview.value.day, 1) : undefined)
const maxDate = computed(() => overview.value ? addDays(overview.value.day, DAILY_PIN_HORIZON_DAYS) : undefined)

const lookupQuery = computed(() => wordSearch.value.trim())
const { data: lookup, status: lookupStatus } = useFetch<{ items: Array<{ id: string, label: string }> }>('/api/admin/lookup/word', {
  query: computed(() => (lookupQuery.value ? { q: lookupQuery.value } : {})),
  watch: [lookupQuery],
  server: false
})
const wordChoices = computed(() => (lookup.value?.items ?? []).map(item => ({ label: item.label, value: item.id })))

const villageChoices = computed(() => [
  { label: 'Automatski', value: 'auto' },
  { label: 'Bez oznake mjesta', value: 'none' },
  ...(selectedWord.value?.areas ?? []).map(area => ({ label: area.name, value: area.id }))
])
const canPin = computed(() => !!overview.value && !!date.value && !!wordId.value && !busy.value
  && date.value >= minDate.value! && date.value <= maxDate.value!)

const CALENDAR_DAYS = 28
const WEEKDAYS = ['pon', 'uto', 'sri', 'čet', 'pet', 'sub', 'ned']
const MONTHS = ['siječnja', 'veljače', 'ožujka', 'travnja', 'svibnja', 'lipnja', 'srpnja', 'kolovoza', 'rujna', 'listopada', 'studenoga', 'prosinca']
const weekdayIndex = (day: string) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7
const longDate = (day: string) => `${Number(day.slice(8))}. ${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}.`
const shortDate = (day: string) => `${Number(day.slice(8))}. ${Number(day.slice(5, 7))}.`

interface CalendarCell { day: string, kind: 'past' | 'today' | 'pinned' | 'auto', word?: string, village?: string, weekday: string }
/** The days from the Monday of this week for four weeks: past days muted, today outlined, pinned days with their word. */
const calendar = computed<CalendarCell[]>(() => {
  const current = overview.value
  if (!current) return []
  const start = addDays(current.day, -weekdayIndex(current.day))
  const known = new Map([...current.recent, ...(current.today ? [current.today] : []), ...current.pins].map(item => [item.day, item]))
  return Array.from({ length: CALENDAR_DAYS }, (_, index) => {
    const day = addDays(start, index)
    const item = known.get(day)
    const weekday = WEEKDAYS[index % 7]!
    if (day < current.day) return { day, kind: 'past', word: item?.headword, weekday }
    if (day === current.day) return { day, kind: 'today', word: item?.headword, weekday }
    return item ? { day, kind: 'pinned', word: item.headword, village: villageLabel(item), weekday } : { day, kind: 'auto', weekday }
  })
})
const coverage = computed(() => {
  const last = overview.value?.pins.at(-1)
  return last ? `Prikvačeno do ${longDate(last.day)}. Dani bez prikvačene riječi dobivaju riječ automatski.` : 'Nema prikvačenih riječi. Svaki dan dobiva riječ automatski.'
})
function scheduleOn(cell: CalendarCell) {
  if (cell.kind === 'pinned') return
  date.value = cell.day
  formOpen.value = true
}

watch(wordId, async (id) => {
  village.value = 'auto'
  if (!id) {
    selectedWord.value = null
    return
  }
  try {
    selectedWord.value = (await $fetch<{ entity: Word }>(`/api/admin/content/word/${id}`)).entity
  } catch {
    selectedWord.value = null
  }
})

function villageLabel(day: DailyAdminDay) {
  if (day.village === 'auto') return 'mjesto automatski'
  if (day.village === 'none') return 'bez oznake mjesta'
  return `mjesto: ${selectedWord.value?.areas.find(a => a.id === day.village)?.name ?? day.village}`
}

function fail(err: unknown) {
  const e = err as { statusCode?: number, data?: { data?: { message?: string } } }
  if (e.statusCode === 401) {
    navigateTo('/admin/prijava')
    error.value = 'Pogrešna lozinka.'
    return
  }
  error.value = e.data?.data?.message
    || (e.statusCode === 503 ? 'Baza ili pregled nisu konfigurirani.' : e.statusCode === 429 ? 'Previše pokušaja. Pokušaj poslije.' : 'Radnja nije uspjela. Pokušaj opet.')
}

async function refresh() {
  loading.value = true
  try {
    overview.value = await $fetch<DailyAdminOverview>('/api/review/daily')
    error.value = ''
  } catch (err) {
    fail(err)
  } finally {
    loading.value = false
  }
}

async function pin() {
  if (!canPin.value || !selectedWord.value) return
  const headword = selectedWord.value.headword
  if (!await confirm({
    title: `Prikvačiti „${headword}” za ${date.value}?`,
    description: 'Prikvačena riječ zamjenjuje automatski odabir za taj dan.',
    confirmLabel: 'Prikvači'
  })) return
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const result = await $fetch<DailyPinResult>(`/api/review/daily/${date.value}`, { method: 'PUT', body: { wordId: wordId.value, village: village.value } })
    notice.value = `Riječ „${result.headword}“ prikvačena je za ${result.day}.`
    date.value = ''
    wordId.value = ''
    await refresh()
  } catch (err) {
    fail(err)
  } finally {
    busy.value = false
  }
}

async function unpin(day: DailyAdminDay) {
  if (!await confirm({
    title: `Ukloniti prikvačenu riječ za ${day.day}?`,
    description: `Riječ „${day.headword}” više neće biti fiksirana za taj dan.`,
    confirmLabel: 'Ukloni',
    color: 'error'
  })) return
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    await $fetch(`/api/review/daily/${day.day}`, { method: 'DELETE' })
    notice.value = `Prikvačena riječ „${day.headword}“ uklonjena je za ${day.day}.`
    await refresh()
  } catch (err) {
    fail(err)
  } finally {
    busy.value = false
  }
}

watch(() => route.query.pin, (pin) => {
  if (typeof pin === 'string') {
    wordId.value = pin
    formOpen.value = true
    nextTick(() => heading.value?.focus())
  }
}, { immediate: true })

onMounted(refresh)
</script>

<template>
  <AdminPanel
    title="Riječ dana"
    icon="i-lucide-calendar-days"
  >
    <template #actions>
      <UButton
        label="Rasporedi riječ"
        icon="i-lucide-calendar-plus"
        :disabled="!overview"
        data-test="daily-schedule"
        @click="formOpen = true"
      />
    </template>

    <div
      id="rijec-dana"
      class="flex flex-col gap-4"
      lang="hr"
    >
      <h2
        ref="heading"
        tabindex="-1"
        class="sr-only"
      >
        Raspored
      </h2>
      <UAlert
        v-if="error"
        :title="overview ? error : 'Raspored nismo uspjeli učitati'"
        :description="overview ? undefined : 'Riječi koje su već raspoređene i dalje se prikazuju posjetiteljima.'"
        color="error"
        variant="subtle"
        role="alert"
        :actions="overview ? undefined : [{ label: 'Pokušaj ponovno', color: 'neutral', variant: 'outline', onClick: refresh }]"
      />
      <UAlert
        v-if="notice"
        :title="notice"
        color="success"
        variant="subtle"
        role="status"
      />
      <template v-if="overview">
        <p
          class="text-muted"
          data-test="daily-coverage"
        >
          {{ coverage }}
        </p>
        <p data-test="daily-today">
          <span class="text-muted">Danas ({{ overview.day }}): </span>
          <template v-if="overview.today">
            <strong class="text-highlighted">{{ overview.today.headword }}</strong>
            · {{ overview.today.source === 'pinned' ? 'prikvačeno' : 'automatski odabrano' }}
          </template>
          <template v-else>
            još nije odabrana; odabire se pri prvom otvaranju riječi dana.
          </template>
        </p>
        <UAlert
          v-for="warning in overview.warnings"
          :key="`${warning.code}-${warning.day ?? ''}-${warning.wordId ?? ''}`"
          :title="warning.message"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
        />

        <ol
          class="grid grid-cols-1 gap-2 md:grid-cols-7"
          aria-label="Raspored riječi dana"
          data-test="daily-calendar"
        >
          <li
            v-for="cell in calendar"
            :key="cell.day"
            class="flex min-h-24 flex-col gap-1 rounded-lg border p-2 text-sm"
            :class="{
              'border-default bg-elevated text-muted': cell.kind === 'past',
              'border-2 border-inverted': cell.kind === 'today',
              'border-solid border-default': cell.kind === 'pinned',
              'border-dashed border-default text-muted': cell.kind === 'auto'
            }"
            :data-kind="cell.kind"
          >
            <time
              :datetime="cell.day"
              class="text-xs"
            ><span class="md:hidden">{{ cell.weekday }}, </span>{{ shortDate(cell.day) }}<span
              v-if="cell.kind === 'today'"
              class="ms-1 font-bold"
            >danas</span></time>
            <template v-if="cell.word">
              <strong class="text-highlighted">{{ cell.word }}</strong>
              <span
                v-if="cell.village"
                class="text-xs text-muted"
              >{{ cell.village }}</span>
            </template>
            <span
              v-else-if="cell.kind === 'auto'"
              class="text-xs"
            >automatski</span>
            <span
              v-else
              class="text-xs"
            >—</span>
            <div
              v-if="cell.kind === 'pinned'"
              class="mt-auto flex items-center gap-1"
            >
              <UBadge
                label="prikvačeno"
                size="sm"
                variant="subtle"
                color="neutral"
              />
              <UButton
                icon="i-lucide-x"
                size="xs"
                color="neutral"
                variant="ghost"
                :aria-label="`Ukloni prikvačenu riječ ${cell.word} za ${cell.day}`"
                :disabled="busy"
                @click="unpin(overview.pins.find(pin => pin.day === cell.day)!)"
              />
            </div>
            <UButton
              v-else-if="cell.kind === 'auto'"
              label="Rasporedi"
              size="xs"
              color="neutral"
              variant="link"
              class="mt-auto self-start px-0"
              :aria-label="`Rasporedi riječ za ${cell.day}`"
              @click="scheduleOn(cell)"
            />
          </li>
        </ol>

        <dl
          class="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]"
          data-test="daily-runway"
        >
          <dt class="text-muted">
            Spremne neiskorištene riječi
          </dt><dd>{{ overview.runway.readyUnused }}</dd>
          <dt class="text-muted">
            Neiskorištene riječi
          </dt><dd>{{ overview.runway.unused }}</dd>
          <dt class="text-muted">
            Aktivne riječi
          </dt><dd>{{ overview.runway.active }}</dd>
          <dt class="text-muted">
            Dana bez ponavljanja
          </dt><dd>{{ overview.runway.daysLeft }}</dd>
        </dl>
      </template>
      <p
        v-else-if="loading"
        class="text-muted"
        role="status"
      >
        Učitavanje rasporeda…
      </p>
    </div>

    <UModal
      v-model:open="formOpen"
      title="Rasporedi riječ"
      description="Prikvačena riječ zamjenjuje automatski odabir za taj dan."
    >
      <template #body>
        <form
          id="daily-pin-form"
          class="flex flex-col gap-3"
          @submit.prevent="pin().then(() => { if (!wordId) formOpen = false })"
        >
          <AdminFormField
            label="Datum"
            :help="minDate ? `Od ${minDate}; današnji i prošli dani su zaključani.` : undefined"
          >
            <UInput
              v-model="date"
              type="date"
              :min="minDate"
              :max="maxDate"
              class="w-full"
            />
          </AdminFormField>
          <AdminFormField label="Pretraži aktivne riječi">
            <UInput
              v-model="wordSearch"
              icon="i-lucide-search"
              class="w-full"
            />
          </AdminFormField>
          <AdminFormField label="Riječ">
            <USelect
              v-model="wordId"
              :items="wordChoices"
              :loading="lookupStatus === 'pending'"
              placeholder="Odaberi riječ"
              class="w-full"
            />
          </AdminFormField>
          <AdminFormField label="Oznaka mjesta">
            <USelect
              v-model="village"
              :items="villageChoices"
              class="w-full"
            />
          </AdminFormField>
        </form>
      </template>
      <template #footer>
        <UButton
          label="Odustani"
          color="neutral"
          variant="ghost"
          @click="formOpen = false"
        />
        <UButton
          type="submit"
          form="daily-pin-form"
          label="Spremi u raspored"
          icon="i-lucide-pin"
          :disabled="!canPin"
          :loading="busy"
        />
      </template>
    </UModal>
  </AdminPanel>
</template>
