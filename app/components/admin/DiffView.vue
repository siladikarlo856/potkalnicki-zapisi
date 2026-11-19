<script setup lang="ts">
import type { HistoryChangeRow } from '~~/shared/utils/content/history'

// Two versions of a field side by side in time: the old value (dashed border, struck through, a minus, tag "Prije") over the
// new one (ok border and fill, a plus, tag "Poslije"). Old and new are told apart by tag word, icon and border style, never by
// colour alone. Shows only the fields that changed; the consumer names the sides ("Sada piše" / "Prijedlog", "Dodano").
const props = withDefaults(defineProps<{
  rows: HistoryChangeRow[]
  oldTag?: string
  newTag?: string
  /** Only the new side (a creation): the tag becomes `addedTag`. */
  hideOld?: boolean
  /** Only the old side (a deletion). */
  hideNew?: boolean
  addedTag?: string
}>(), { oldTag: 'Prije', newTag: 'Poslije', addedTag: 'Dodano' })
/** A value the field did not have before reads "Dodano"; one that replaces another reads "Poslije". */
const newSideTag = (row: HistoryChangeRow) => row.beforeEmpty && !props.hideOld ? props.addedTag : props.newTag
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
    data-testid="diff-view"
  >
    <div
      v-for="row in rows"
      :key="row.key"
      class="flex flex-col gap-1"
      :data-test="`history-change-${row.key}`"
    >
      <dt class="text-xs font-bold tracking-wide text-muted uppercase">
        {{ row.label }}
      </dt>
      <dd class="m-0 flex flex-col gap-1 text-sm">
        <div
          v-if="!hideOld"
          class="flex items-start gap-2 rounded-md border-[1.5px] border-dashed border-accented px-2 py-1 wrap-anywhere whitespace-pre-wrap text-muted"
          data-testid="diff-old"
        >
          <UIcon
            name="i-lucide-minus"
            class="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span :class="row.beforeEmpty ? '' : 'line-through'"><b class="text-xs font-bold tracking-wide uppercase no-underline">{{ oldTag }}:</b> {{ row.before }}</span>
        </div>
        <div
          v-if="!hideNew"
          class="flex items-start gap-2 rounded-md border-[1.5px] border-success bg-(--pz-ok-bg) px-2 py-1 wrap-anywhere whitespace-pre-wrap text-success"
          data-testid="diff-new"
        >
          <UIcon
            name="i-lucide-plus"
            class="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span><b class="text-xs font-bold tracking-wide uppercase">{{ newSideTag(row) }}:</b> {{ row.after }}</span>
        </div>
      </dd>
    </div>
  </dl>
</template>
