<script setup lang="ts">
import type { ContentKind } from '~~/shared/utils/content/common'
import type { HistoryAction, HistoryChange } from '~~/shared/utils/content/history'
import { expandHistoryChange, historyFieldMeta } from '~~/shared/utils/content/history'

// The fields one revision changed, as the DiffView shows them. A creation lists only the values it started with and a
// deletion the values the row had when it was removed.
const props = defineProps<{
  kind: ContentKind
  action: HistoryAction
  changes: HistoryChange[]
}>()

// A structured field (a challenge set) lists each changed part on its own row.
const rows = computed(() => props.changes.flatMap(change => expandHistoryChange(historyFieldMeta(props.kind, change.field), change)))
</script>

<template>
  <AdminDiffView
    :rows="rows"
    :hide-old="action === 'insert'"
    :hide-new="action === 'delete'"
  />
</template>
