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
    nextTick(() => heading.value?.focus())
  }
}, { immediate: true })

onMounted(refresh)
</script>

<template>
  <AdminPanel
    title="Riječ dana"
    description="Raspored, zaliha riječi i prikvačeni dani. Brojevi zalihe računaju se na poslužitelju preko svih aktivnih riječi."
    icon="i-lucide-calendar-days"
  >
    <UCard id="rijec-dana">
      <template #header>
        <h2
          ref="heading"
          tabindex="-1"
          class="text-xl font-semibold text-highlighted"
        >
          Raspored
        </h2>
      </template>
      <div
        class="flex flex-col gap-4"
        lang="hr"
      >
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
        <template v-if="overview">
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
          <UAlert
            v-for="warning in overview.warnings"
            :key="`${warning.code}-${warning.day ?? ''}-${warning.wordId ?? ''}`"
            :title="warning.message"
            color="warning"
            variant="subtle"
          />
          <section aria-labelledby="daily-pins-title">
            <h3
              id="daily-pins-title"
              class="font-semibold text-highlighted"
            >
              Prikvačene riječi
            </h3>
            <p
              v-if="!overview.pins.length"
              class="text-sm text-muted"
            >
              Nema prikvačenih riječi.
            </p>
            <ul
              v-else
              class="mt-2 flex flex-col gap-2"
            >
              <li
                v-for="item in overview.pins"
                :key="item.day"
                class="flex flex-wrap items-center gap-2"
              >
                <time :datetime="item.day">{{ item.day }}</time>
                <strong class="text-highlighted">{{ item.headword }}</strong>
                <span class="text-sm text-muted">{{ villageLabel(item) }}</span>
                <UButton
                  label="Ukloni"
                  icon="i-lucide-x"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  :aria-label="`Ukloni prikvačenu riječ ${item.headword} za ${item.day}`"
                  :disabled="busy"
                  @click="unpin(item)"
                />
              </li>
            </ul>
          </section>
          <form
            class="flex flex-col gap-3"
            aria-labelledby="daily-pin-form-title"
            @submit.prevent="pin"
          >
            <h3
              id="daily-pin-form-title"
              class="font-semibold text-highlighted"
            >
              Prikvači riječ
            </h3>
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField
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
              </UFormField>
              <UFormField label="Pretraži aktivne riječi">
                <UInput
                  v-model="wordSearch"
                  icon="i-lucide-search"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Riječ">
                <USelect
                  v-model="wordId"
                  :items="wordChoices"
                  :loading="lookupStatus === 'pending'"
                  placeholder="Odaberi riječ"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Oznaka mjesta">
                <USelect
                  v-model="village"
                  :items="villageChoices"
                  class="w-full"
                />
              </UFormField>
            </div>
            <UButton
              type="submit"
              label="Prikvači"
              icon="i-lucide-pin"
              :disabled="!canPin"
              :loading="busy"
            />
          </form>
        </template>
        <p
          v-else-if="loading"
          class="text-muted"
        >
          Učitavam…
        </p>
        <UButton
          v-else
          label="Pokušaj ponovno"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="outline"
          @click="refresh"
        />
      </div>
    </UCard>
  </AdminPanel>
</template>
