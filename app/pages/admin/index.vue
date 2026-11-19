<script setup lang="ts">
import { HISTORY_ACTION_LABELS, HISTORY_KIND_META } from '~~/shared/utils/content/history'
import { DAILY_HORIZON_DAYS, useAdminDashboard } from '~/composables/useAdminDashboard'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Nadzorna ploča', robots: 'noindex, nofollow' })

const dash = useAdminDashboard()
const { pending: pendingBadge } = useAdminPending()

// "Novi zapis": a menu of the resources that open their editor.
const createItems = [[
  { label: 'Mjesto', to: '/admin/mjesta?novo=1' },
  { label: 'Zapis baštine', to: '/admin/bastina?novo=1' },
  { label: 'Osoba', to: '/admin/osobe?novo=1' },
  { label: 'Klub', to: '/admin/klubovi?novo=1' },
  { label: 'Riječ', to: '/admin/rijeci?novo=1' },
  { label: 'Priča', to: '/admin/price?novo=1' },
  { label: 'Običaj', to: '/admin/obicaji?novo=1' },
  { label: 'Usmeni tekst', to: '/admin/usmeni-tekstovi?novo=1' }
]]

const inboxTotal = computed(() => dash.inbox.data.value?.total ?? 0)
const outdatedTotal = computed(() => dash.outdated.data.value?.total ?? 0)
const draftsTotal = computed(() => dash.drafts.data.value?.total ?? 0)
/** "3 baština · 2 osobe": where the work is, and the first of them as the link target. */
function kindBreakdown(byKind: Array<{ kind: keyof typeof HISTORY_KIND_META, count: number }> | undefined) {
  return (byKind ?? []).map(entry => `${entry.count} ${HISTORY_KIND_META[entry.kind].plural.toLowerCase()}`).join(' · ')
}
function kindPath(byKind: Array<{ kind: keyof typeof HISTORY_KIND_META }> | undefined) {
  return HISTORY_KIND_META[byKind?.[0]?.kind ?? 'heritage_item'].adminPath
}
const gaps = computed(() => dash.daily.data.value?.gaps ?? [])
const recent = computed(() => dash.recent.data.value?.rows ?? [])

// Counts that failed are left out rather than shown as zero, so the "all clear" state is never claimed on missing data.
const countsReady = computed(() => dash.inbox.status.value === 'success' && dash.outdated.status.value === 'success' && dash.drafts.status.value === 'success' && dash.daily.status.value === 'success')
const allClear = computed(() => countsReady.value && !inboxTotal.value && !outdatedTotal.value && !draftsTotal.value && !gaps.value.length)
const firstTime = computed(() => dash.places.status.value === 'success' && dash.places.data.value?.total === 0)
const countFailures = computed(() => dash.failed.value.filter(name => name !== 'recent'))

const today = computed(() => dash.daily.data.value?.overview.today ?? null)
const tomorrow = computed(() => {
  const overview = dash.daily.data.value?.overview
  if (!overview) return null
  const next = new Date(`${overview.day}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return overview.pins.find(pin => pin.day === next.toISOString().slice(0, 10)) ?? null
})

function recentLink(row: (typeof recent.value)[number]) {
  const meta = HISTORY_KIND_META[row.kind]
  return row.registered && row.action !== 'delete' ? { path: meta.adminPath, query: { uredi: row.entityId } } : undefined
}
const gapDay = (day: string) => longDate(new Date(`${day}T00:00:00`))
</script>

<template>
  <AdminPanel
    title="Nadzorna ploča"
    icon="i-lucide-layout-dashboard"
  >
    <template #actions>
      <UDropdownMenu
        :items="createItems"
        :content="{ align: 'end' }"
      >
        <UButton
          label="Novi zapis"
          icon="i-lucide-plus"
          trailing-icon="i-lucide-chevron-down"
          data-testid="admin-create"
        />
      </UDropdownMenu>
    </template>

    <p
      v-if="dash.loading.value"
      class="sr-only"
      role="status"
    >
      Učitavanje nadzorne ploče…
    </p>

    <UAlert
      v-if="countFailures.length"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Neke brojeve nismo uspjeli učitati"
      description="Provjeri vezu i pokušaj ponovno. Ništa nije izgubljeno."
      :actions="[{ label: 'Pokušaj ponovno', color: 'neutral', variant: 'outline', onClick: () => dash.refresh() }]"
      role="alert"
      data-testid="admin-dashboard-error"
    />

    <section
      v-if="firstTime"
      class="flex flex-col items-start gap-3 rounded-lg border border-default bg-default p-6"
      data-testid="admin-dashboard-first-time"
    >
      <UIcon
        name="i-lucide-library-big"
        class="size-8 text-muted"
        aria-hidden="true"
      />
      <h2 class="pz-h3 text-highlighted">
        Arhiv je još prazan
      </h2>
      <p class="max-w-[60ch] text-muted">
        Počni od mjesta: unesi općine i naselja, pa dodaj prvi zapis o baštini ili prve riječi.
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton
          label="Unesi mjesta"
          to="/admin/mjesta"
        />
        <UDropdownMenu :items="createItems">
          <UButton
            label="Novi zapis"
            color="neutral"
            variant="outline"
            trailing-icon="i-lucide-chevron-down"
          />
        </UDropdownMenu>
      </div>
    </section>

    <template v-else>
      <section
        v-if="allClear"
        class="flex flex-col items-start gap-2 rounded-lg border border-default bg-default p-6"
        data-testid="admin-dashboard-clear"
      >
        <UIcon
          name="i-lucide-check"
          class="size-8 text-success"
          aria-hidden="true"
        />
        <h2 class="pz-h3 text-highlighted">
          Sve je pregledano
        </h2>
        <p class="max-w-[60ch] text-muted">
          Nema zaprimljenih priloga, zastarjelih zapisa ni praznina u rasporedu riječi dana.
        </p>
      </section>

      <section
        v-else
        aria-label="Što čeka urednika"
        class="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <template v-if="dash.loading.value && !countsReady && !countFailures.length">
          <USkeleton
            v-for="index in 4"
            :key="index"
            class="h-28 w-full"
            aria-hidden="true"
          />
        </template>
        <template v-else>
          <AdminDashboardCard
            v-if="dash.inbox.status.value === 'success'"
            to="/admin/prijedlozi"
            :count="inboxTotal || pendingBadge"
            :label="nounFor(inboxTotal, ['prilog čeka pregled', 'priloga čekaju pregled', 'priloga čeka pregled'])"
            :detail="dash.inbox.data.value?.counts.map(entry => entry.phrase).join(' · ') || 'Otvori Prijedloge'"
            attention
          />
          <AdminDashboardCard
            v-if="dash.outdated.status.value === 'success'"
            :to="{ path: kindPath(dash.outdated.data.value?.byKind), query: { verification: 'needs_update' } }"
            :count="outdatedTotal"
            :label="nounFor(outdatedTotal, ['zapis treba ažurirati', 'zapisa treba ažurirati', 'zapisa treba ažurirati'])"
            :detail="kindBreakdown(dash.outdated.data.value?.byKind) || 'Označeno kao „Treba ažurirati”'"
          />
          <AdminDashboardCard
            v-if="dash.drafts.status.value === 'success'"
            :to="{ path: kindPath(dash.drafts.data.value?.byKind), query: { status: 'draft', sort: 'updatedAt' } }"
            :count="draftsTotal"
            :label="nounFor(draftsTotal, ['skica starija od 30 dana', 'skice starije od 30 dana', 'skica starijih od 30 dana'])"
            :detail="kindBreakdown(dash.drafts.data.value?.byKind) || 'Dovrši ih ili arhiviraj'"
          />
          <AdminDashboardCard
            v-if="dash.daily.status.value === 'success'"
            to="/admin/rijec-dana"
            :count="gaps.length"
            :label="nounFor(gaps.length, ['dan bez prikvačene riječi', 'dana bez prikvačene riječi', 'dana bez prikvačene riječi'])"
            :detail="`U sljedećih ${DAILY_HORIZON_DAYS} dana`"
          />
        </template>
      </section>
    </template>

    <div class="grid gap-4 lg:grid-cols-5">
      <section
        aria-labelledby="admin-recent"
        class="rounded-lg border border-default bg-default p-4 lg:col-span-3"
      >
        <h2
          id="admin-recent"
          class="pz-h3 mb-3 text-highlighted"
        >
          Nedavne izmjene
        </h2>
        <UAlert
          v-if="dash.recent.status.value === 'error'"
          color="warning"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Nedavne izmjene nismo uspjeli učitati"
          description="Brojevi gore su točni. Ostalo će se pojaviti kad se veza vrati."
          role="alert"
          data-testid="admin-dashboard-partial"
        />
        <ul
          v-else-if="recent.length"
          class="divide-y divide-default"
        >
          <li
            v-for="row in recent"
            :key="row.id"
            class="flex flex-wrap items-baseline justify-between gap-x-3 py-2"
          >
            <span class="min-w-0">
              <NuxtLink
                v-if="recentLink(row)"
                :to="recentLink(row)"
                class="font-bold text-default underline-offset-2 hover:underline"
              >{{ row.label }}</NuxtLink>
              <span
                v-else
                class="font-bold"
              >{{ row.label }}</span>
              <span class="pz-caption text-muted"> · {{ HISTORY_KIND_META[row.kind].singular }} · {{ HISTORY_ACTION_LABELS[row.action].toLowerCase() }}</span>
            </span>
            <time
              :datetime="row.createdAt"
              class="pz-caption text-muted tabular-nums"
            >{{ shortDate(row.createdAt) }}</time>
          </li>
        </ul>
        <p
          v-else-if="dash.recent.status.value === 'success'"
          class="text-muted"
        >
          Još nema zabilježenih izmjena.
        </p>
        <USkeleton
          v-else
          class="h-24 w-full"
          aria-hidden="true"
        />
        <NuxtLink
          to="/admin/povijest"
          class="pz-caption mt-3 inline-block text-primary underline underline-offset-2"
        >
          Sva povijest izmjena
        </NuxtLink>
      </section>

      <section
        aria-labelledby="admin-daily"
        class="rounded-lg border border-default bg-default p-4 lg:col-span-2"
      >
        <h2
          id="admin-daily"
          class="pz-h3 mb-3 text-highlighted"
        >
          Riječ dana
        </h2>
        <dl
          v-if="dash.daily.status.value === 'success'"
          class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1"
        >
          <dt class="text-muted">
            Danas
          </dt>
          <dd class="m-0 font-bold">
            {{ today?.headword ?? 'još nije otvorena' }}
          </dd>
          <dt class="text-muted">
            Sutra
          </dt>
          <dd class="m-0 font-bold">
            {{ tomorrow?.headword ?? 'bira se sama' }}
          </dd>
          <template v-if="gaps.length">
            <dt class="text-muted">
              Prvi dan bez prikvačene riječi
            </dt>
            <dd class="m-0 font-bold">
              {{ gapDay(gaps[0]!) }}
            </dd>
          </template>
        </dl>
        <USkeleton
          v-else-if="dash.daily.status.value !== 'error'"
          class="h-16 w-full"
          aria-hidden="true"
        />
        <NuxtLink
          to="/admin/rijec-dana"
          class="pz-caption mt-3 inline-block text-primary underline underline-offset-2"
        >
          Otvori raspored
        </NuxtLink>
      </section>
    </div>
  </AdminPanel>
</template>
