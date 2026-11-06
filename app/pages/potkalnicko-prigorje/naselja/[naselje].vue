<script setup lang="ts">
import type { AtlasSettlementResponse } from '~~/shared/types/publicAtlas'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

const settlementSlug = computed(() => String(route.params.naselje))
const { data: page } = await useAtlasFetch<AtlasSettlementResponse>(
  () => `/api/atlas/settlements/${settlementSlug.value}`
)

const correctionOpen = ref(false)
const proposalOpen = ref(false)
const formatDate = (iso: string) => new Intl.DateTimeFormat('hr-HR', { dateStyle: 'long' }).format(new Date(iso))
const settlement = computed(() => page.value?.settlement)
const municipality = computed(() => page.value?.municipality)
const persons = computed(() => page.value?.persons ?? [])

const items = computed(() => (page.value?.items ?? []).map(item => ({
  ...item,
  to: item.path ? localePath(item.path) : undefined,
  categoryLabel: item.category.label
})))

useSeoMeta({
  title: () => settlement.value ? `${settlement.value.name} · Potkalnički zapisi` : '',
  description: () => settlement.value && municipality.value
    ? t('pz.explore.settlementPageDescription', {
        name: settlement.value.name,
        municipality: municipality.value.label,
        count: items.value.length
      })
    : ''
})
</script>

<template>
  <div v-if="settlement && municipality">
    <UPageHero
      :title="settlement.name"
      :description="t('pz.explore.settlementPageDescription', {
        name: settlement.name,
        municipality: municipality.label,
        count: items.length
      })"
      :links="[
        { label: municipality.label, to: localePath(`/potkalnicko-prigorje/istrazi/${municipality.slug}`), color: 'neutral', variant: 'ghost' },
        { label: t('pz.explore.allRegions'), to: localePath('/potkalnicko-prigorje/istrazi'), color: 'neutral', variant: 'ghost' }
      ]"
      :ui="{ container: 'py-12 sm:py-16' }"
    />

    <UPageSection
      :title="t('pz.heritage.settlementItemsTitle')"
      :ui="{ root: 'border-t border-default' }"
    >
      <ul
        v-if="items.length"
        class="divide-y divide-default rounded-lg ring ring-default"
        data-testid="settlement-heritage-list"
      >
        <li
          v-for="item in items"
          :key="item.id"
        >
          <ULink
            v-if="item.to"
            :to="item.to"
            class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-elevated/40"
          >
            <span>
              <span class="font-medium text-highlighted">{{ item.name }}</span>
              <span class="ml-2 text-muted">{{ item.categoryLabel }}</span>
            </span>
            <PzVerificationBadge :verification="item.verification" />
          </ULink>
          <div
            v-else
            class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <span>
              <span class="font-medium text-highlighted">{{ item.name }}</span>
              <span
                v-if="item.locality"
                class="ml-1 text-muted"
              >({{ item.locality }})</span>
            </span>
            <PzVerificationBadge :verification="item.verification" />
          </div>
        </li>
      </ul>
      <p
        v-else
        class="text-sm text-muted"
      >
        {{ t('pz.heritage.emptySettlement') }}
      </p>
    </UPageSection>

    <UPageSection
      v-if="persons.length"
      :title="t('pz.persons.fromThisPlace')"
      :ui="{ root: 'border-t border-default' }"
    >
      <PersonsList
        :persons="persons"
        testid="settlement-persons"
      />
    </UPageSection>

    <UPageSection :ui="{ root: 'border-t border-default' }">
      <div class="flex flex-wrap gap-3">
        <UButton
          :label="t('pz.heritage.suggestSettlementCorrection')"
          icon="i-lucide-pencil"
          color="neutral"
          variant="outline"
          aria-haspopup="dialog"
          data-testid="settlement-suggest-correction"
          @click="correctionOpen = true"
        />
        <UButton
          :label="t('pz.heritage.suggestItemIn', { name: settlement.name })"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          aria-haspopup="dialog"
          data-testid="settlement-suggest-item"
          @click="proposalOpen = true"
        />
      </div>
      <p
        v-if="settlement.credits.length"
        class="mt-4 text-sm text-muted"
        data-testid="settlement-credits"
      >
        {{ t('pz.heritage.credits', { names: settlement.credits.map(credit => credit.name).join(', ') }) }}
      </p>
      <p
        class="mt-2 text-xs text-muted"
        data-testid="settlement-updated"
      >
        {{ t('pz.heritage.updatedAt', { date: formatDate(settlement.updatedAt) }) }}
      </p>
      <HeritageSuggestDialog
        v-model:open="correctionOpen"
        kind="area"
        mode="correction"
        :target="{ id: settlement.id, label: settlement.name }"
        :current="{ name: settlement.name }"
      />
      <HeritageSuggestDialog
        v-model:open="proposalOpen"
        kind="heritage_item"
        mode="proposal"
        :prefill="{ settlementId: settlement.id }"
      />
    </UPageSection>
  </div>
</template>
