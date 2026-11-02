<script setup lang="ts">
import type { ContentKind } from '~~/shared/utils/content/common'
import type { HistoryAction, HistoryChange } from '~~/shared/utils/content/history'
import { formatHistoryValue, historyFieldMeta } from '~~/shared/utils/content/history'

// The fields one revision changed, each as "before → after". A creation lists only the values it
// started with and a deletion the values the row had when it was removed.
const props = defineProps<{
  kind: ContentKind
  action: HistoryAction
  changes: HistoryChange[]
}>()

const rows = computed(() => props.changes.map((change) => {
  const meta = historyFieldMeta(props.kind, change.field)
  return {
    field: change.field,
    label: meta.label,
    before: formatHistoryValue(meta, change.before),
    after: formatHistoryValue(meta, change.after),
    beforeEmpty: change.before === null || change.before === undefined || change.before === '',
    afterEmpty: change.after === null || change.after === undefined || change.after === ''
  }
}))
</script>

<template>
  <p
    v-if="!rows.length"
    class="text-sm text-muted"
  >
    Bez promjena u uređivanim poljima.
  </p>
  <dl
    v-else
    class="flex flex-col gap-3"
    data-test="history-changes"
  >
    <div
      v-for="row in rows"
      :key="row.field"
      class="flex flex-col gap-1"
      :data-test="`history-change-${row.field}`"
    >
      <dt class="text-xs font-medium uppercase tracking-wide text-muted">
        {{ row.label }}
      </dt>
      <dd class="flex flex-col gap-1 text-sm">
        <div
          v-if="action !== 'insert'"
          class="rounded-md bg-error/10 px-2 py-1 whitespace-pre-wrap break-words text-error"
          :class="{ 'line-through decoration-error/50': !row.beforeEmpty && action === 'update' }"
        >
          <span class="sr-only">Prije: </span>{{ row.before }}
        </div>
        <div
          v-if="action !== 'delete'"
          class="rounded-md bg-success/10 px-2 py-1 whitespace-pre-wrap break-words text-success"
        >
          <span class="sr-only">Poslije: </span>{{ row.after }}
        </div>
      </dd>
    </div>
  </dl>
</template>
