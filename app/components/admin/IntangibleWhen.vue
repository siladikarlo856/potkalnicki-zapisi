<script setup lang="ts">
import {
  INTANGIBLE_LIMITS, PERIOD_UNITS, PERIOD_UNIT_LABELS, RECORDED_PRECISIONS, RECORDED_PRECISION_LABELS
} from '#shared/utils/content/intangible'
import type { Period, PeriodUnit, RecordedOn, RecordedPrecision } from '#shared/utils/content/intangible'
import { MONTH_NAMES, numberOrNull, periodValueHint, withPeriodUnit, withRecordedPrecision } from '~/utils/intangibleForm'

// "Zabilježeno" (when the record was made: day, month or year, only as far as it is known) and, for a Story or a
// Custom, the free-text period with an optional approximate decade or century that orders the records by time.
const props = defineProps<{
  state: RecordedOn & Partial<Period>
  /** The period's label ("Vrijeme radnje" for a Story, "Vrijeme prakse" for a Custom); a Folk text has no period. */
  periodLabel?: string
}>()
const emit = defineEmits<{ patch: [Partial<RecordedOn & Period>] }>()

const NONE = '__none__'
const precisionOptions = [
  { label: 'Nije poznato', value: NONE },
  ...RECORDED_PRECISIONS.map(value => ({ label: RECORDED_PRECISION_LABELS[value], value }))
]
const monthOptions = MONTH_NAMES.map((label, index) => ({ label: `${index + 1}. ${label}`, value: index + 1 }))
const unitOptions = [
  { label: 'Bez približnog razdoblja', value: NONE },
  ...PERIOD_UNITS.map(value => ({ label: PERIOD_UNIT_LABELS[value], value }))
]

const precision = computed(() => props.state.recordedPrecision)
const showMonth = computed(() => precision.value === 'month' || precision.value === 'day')
const unit = computed(() => props.state.periodUnit ?? null)

function setPrecision(value: string) {
  emit('patch', withRecordedPrecision(props.state, value === NONE ? null : value as RecordedPrecision))
}

function setUnit(value: string) {
  emit('patch', withPeriodUnit({ period: props.state.period ?? null, periodUnit: props.state.periodUnit ?? null, periodValue: props.state.periodValue ?? null }, value === NONE ? null : value as PeriodUnit))
}
</script>

<template>
  <fieldset class="flex flex-col gap-4">
    <legend class="mb-2 text-sm font-semibold text-highlighted">
      Vrijeme
    </legend>

    <AdminFormField
      name="recordedPrecision"
      label="Zabilježeno"
      description="Kad je zapis zabilježen. Upiši samo ono što se zna: ako je poznata samo godina, ne pogađaj dan."
    >
      <USelect
        :model-value="precision ?? NONE"
        :items="precisionOptions"
        class="w-full sm:w-64"
        data-test="admin-recorded-precision"
        @update:model-value="value => setPrecision(String(value))"
      />
    </AdminFormField>

    <div
      v-if="precision"
      class="grid gap-4 sm:grid-cols-3"
    >
      <AdminFormField
        name="recordedYear"
        label="Godina"
        required
      >
        <UInput
          :model-value="state.recordedYear ?? undefined"
          type="number"
          inputmode="numeric"
          class="w-full"
          data-test="admin-recorded-year"
          @update:model-value="value => emit('patch', { recordedYear: numberOrNull(value) })"
        />
      </AdminFormField>
      <AdminFormField
        v-if="showMonth"
        name="recordedMonth"
        label="Mjesec"
        required
      >
        <USelect
          :model-value="state.recordedMonth ?? undefined"
          :items="monthOptions"
          placeholder="Odaberi mjesec"
          class="w-full"
          data-test="admin-recorded-month"
          @update:model-value="value => emit('patch', { recordedMonth: numberOrNull(value) })"
        />
      </AdminFormField>
      <AdminFormField
        v-if="precision === 'day'"
        name="recordedDay"
        label="Dan"
        required
      >
        <UInput
          :model-value="state.recordedDay ?? undefined"
          type="number"
          inputmode="numeric"
          min="1"
          max="31"
          class="w-full"
          data-test="admin-recorded-day"
          @update:model-value="value => emit('patch', { recordedDay: numberOrNull(value) })"
        />
      </AdminFormField>
    </div>

    <template v-if="periodLabel">
      <AdminFormField
        name="period"
        :label="periodLabel"
        optional
        description="Razdoblje riječima kako ga ljudi kazuju, npr. „u turska vremena“ ili „do šezdesetih“."
      >
        <UInput
          :model-value="state.period ?? ''"
          :maxlength="INTANGIBLE_LIMITS.period"
          class="w-full"
          @update:model-value="value => emit('patch', { period: String(value).trim() ? String(value) : null })"
        />
      </AdminFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <AdminFormField
          name="periodUnit"
          label="Približno razdoblje"
          optional
          description="Služi samo za redoslijed zapisa po vremenu."
        >
          <USelect
            :model-value="unit ?? NONE"
            :items="unitOptions"
            class="w-full"
            data-test="admin-period-unit"
            @update:model-value="value => setUnit(String(value))"
          />
        </AdminFormField>
        <AdminFormField
          v-if="unit"
          name="periodValue"
          :label="unit === 'decade' ? 'Desetljeće (prva godina)' : 'Stoljeće'"
          required
          :description="periodValueHint(unit)"
        >
          <UInput
            :model-value="state.periodValue ?? undefined"
            type="number"
            inputmode="numeric"
            :step="unit === 'decade' ? 10 : 1"
            class="w-full"
            data-test="admin-period-value"
            @update:model-value="value => emit('patch', { periodValue: numberOrNull(value) })"
          />
        </AdminFormField>
      </div>
    </template>
  </fieldset>
</template>
