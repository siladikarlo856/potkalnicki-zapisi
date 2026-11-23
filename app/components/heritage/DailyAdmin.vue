<script setup lang="ts">
import type { AdminWord } from '~~/shared/utils/word'
import { addDays } from '~~/shared/utils/dailyWord'
import { DAILY_PIN_HORIZON_DAYS } from '~~/shared/utils/dailyAdmin'
import type { DailyAdminDay, DailyAdminOverview, DailyPinResult } from '~~/shared/utils/dailyAdmin'

const $fetch = useEditorialFetch()

// Admin card "Riječ dana": today's word, the pinned days, the runway and the pin form.
// Everything is counted on the server over all active words, not over the loaded table page.
const props = defineProps<{
  words: AdminWord[]
  /** Set by the per-word "Prikvači za datum" action; a new nonce re-fills the form. */
  request?: { wordId: string, nonce: number }
}>()

const overview = ref<DailyAdminOverview>()
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const heading = useTemplateRef<HTMLElement>('heading')

const date = ref('')
const wordId = ref('')
const village = ref('auto')
const search = ref('')

const minDate = computed(() => overview.value ? addDays(overview.value.day, 1) : undefined)
const maxDate = computed(() => overview.value ? addDays(overview.value.day, DAILY_PIN_HORIZON_DAYS) : undefined)
const choices = computed(() => props.words
  .filter(w => w.active)
  .filter(w => w.entry.id === wordId.value
    || `${w.entry.headword} ${w.entry.meaning.hr}`.toLocaleLowerCase('hr').includes(search.value.trim().toLocaleLowerCase('hr')))
  .map(w => ({ label: `${w.entry.headword} — ${w.entry.meaning.hr}`, value: w.entry.id })))
const selected = computed(() => props.words.find(w => w.entry.id === wordId.value))
const villageChoices = computed(() => [
  { label: 'Automatski', value: 'auto' },
  { label: 'Bez oznake mjesta', value: 'none' },
  ...(selected.value?.areas ?? []).map(area => ({ label: area.name, value: area.id }))
])
const canPin = computed(() => !!overview.value && !!date.value && !!wordId.value && !busy.value
  && date.value >= minDate.value! && date.value <= maxDate.value!)

function villageLabel(day: DailyAdminDay) {
  if (day.village === 'auto') return 'mjesto automatski'
  if (day.village === 'none') return 'bez oznake mjesta'
  return `mjesto: ${props.words.find(w => w.entry.id === day.wordId)?.areas.find(a => a.id === day.village)?.name ?? day.village}`
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
  if (!canPin.value) return
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const result = await $fetch<DailyPinResult>(`/api/review/daily/${date.value}`, { method: 'PUT', body: { wordId: wordId.value, village: village.value } })
    notice.value = `Riječ „${result.headword}“ prikvačena je za ${result.day}.`
    date.value = ''
    await refresh()
  } catch (err) {
    fail(err)
  } finally {
    busy.value = false
  }
}
async function unpin(day: DailyAdminDay) {
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
watch(() => props.request, async (request) => {
  if (!request) return
  wordId.value = request.wordId
  village.value = 'auto'
  await nextTick()
  heading.value?.focus()
}, { immediate: true })
watch(wordId, (_id, previous) => {
  // An area belongs to one word; keep the choice only while the word is unchanged.
  if (previous !== undefined) village.value = 'auto'
})
onMounted(refresh)
defineExpose({ refresh })
</script>

<template>
  <UCard id="rijec-dana">
    <template #header>
      <h2
        ref="heading"
        tabindex="-1"
        class="text-xl font-semibold text-highlighted"
      >
        Riječ dana
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
            <template v-if="overview.today.replacedWordIds.length">
              · zamijenjena riječ ({{ overview.today.replacedWordIds.length }})
            </template>
            <template v-if="!overview.today.resolved">
              · još nije objavljena
            </template>
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
              <UBadge
                v-if="!item.active"
                label="Neaktivna"
                color="warning"
                variant="subtle"
              />
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
        <details v-if="overview.recent.length">
          <summary class="cursor-pointer font-semibold text-highlighted">
            Zadnjih {{ overview.recent.length }} dana
          </summary>
          <ul class="mt-2 flex flex-col gap-1 text-sm">
            <li
              v-for="item in overview.recent"
              :key="item.day"
            >
              <time :datetime="item.day">{{ item.day }}</time>
              · {{ item.headword }}
              <span class="text-muted">({{ item.source === 'pinned' ? 'prikvačeno' : 'automatski' }}{{ item.replacedWordIds.length ? ', zamijenjena riječ' : '' }})</span>
            </li>
          </ul>
        </details>
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
              :help="`Od ${minDate}; današnji i prošli dani su zaključani.`"
            >
              <UInput
                v-model="date"
                type="date"
                :min="minDate"
                :max="maxDate"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Pretraži učitane aktivne riječi">
              <UInput
                v-model="search"
                icon="i-lucide-search"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Riječ">
              <USelect
                v-model="wordId"
                :items="choices"
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
          <div>
            <UButton
              type="submit"
              label="Prikvači"
              icon="i-lucide-pin"
              :disabled="!canPin"
              :loading="busy"
            />
          </div>
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
</template>
