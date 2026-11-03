<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Word, WordValue } from '~~/shared/utils/content/word'
import { CONTENT_STATUS_LABELS, isUuid } from '~~/shared/utils/content/common'
import { dailyReadiness } from '~~/shared/utils/dailyWord'
import { validateAdminWord } from '~~/shared/utils/content/word'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Upravljanje riječima', robots: 'noindex, nofollow' })

const route = useRoute()
const router = useRouter()
watch(() => route.query.edit, (edit) => {
  if (typeof edit === 'string' && isUuid(edit)) {
    router.replace({ query: { ...route.query, uredi: edit, edit: undefined } })
  }
}, { immediate: true })

const READINESS_LABELS = { example: 'primjer', category: 'kategorija', distractors: 'netočni odgovori' } as const
const ENTRY_STATUS_LABELS: Record<string, string> = {
  placeholder: 'Uzorak · placeholder',
  community: 'Zajednica',
  verified: 'Provjereno'
}

const resource = defineAdminResource<Word, WordValue>({
  kind: 'word',
  icon: 'i-lucide-book-open',
  dialogWidth: 'full',
  labels: {
    title: 'Riječi',
    description: 'Skice, izvori i aktivne kartice. Pretraga i straničenje rade na poslužitelju.',
    create: 'Nova riječ',
    edit: 'Uredi riječ',
    empty: 'Još nema riječi.',
    search: 'Pretraži riječi'
  },
  columns: [
    { key: 'headword', label: 'Riječ', sort: 'headword' },
    { key: 'meaningHr', label: 'Značenje', hideBelow: 'md' },
    { key: 'entryStatus', label: 'Urednički status', hideBelow: 'lg' }
  ],
  defaultSort: '-updatedAt',
  blank: () => ({ entry: { id: '', headword: '', meaning: { hr: '' }, status: 'community', sources: [], variants: [] }, areas: [], status: 'draft' }),
  toForm: word => ({ entry: word.entry, areas: word.areas, status: word.status }),
  validate: form => validateAdminWord(form).issues,
  label: word => word.headword || '(bez naslovne riječi)',
  rowActions: (word): DropdownMenuItem[] => [{
    label: 'Prikvači za datum',
    icon: 'i-lucide-pin',
    disabled: word.status !== 'published',
    description: word.status !== 'published' ? 'Prikvačiti se mogu samo aktivne riječi.' : undefined,
    onSelect: () => navigateTo({ path: '/admin/rijec-dana', query: { pin: word.id } })
  }]
})

function readiness(word: Word) {
  const result = dailyReadiness(word.entry, [])
  return {
    label: result.ready ? 'Riječ dana: spremno' : `Riječ dana: nedostaje ${result.missing.map(m => READINESS_LABELS[m]).join(', ')}`,
    color: result.ready ? 'success' as const : 'warning' as const
  }
}

function wordStatusLabel(word: Word) {
  if (word.status === 'published') return 'Aktivna'
  if (word.status === 'draft') return 'Neaktivna skica'
  return CONTENT_STATUS_LABELS.archived
}
</script>

<template>
  <AdminResourcePage :resource="resource">
    <template #dialog="{ visible, editId, prefill, proposalId, closeDialog, refresh }">
      <AdminWordDialog
        :visible="visible"
        :resource="resource"
        :entity-id="editId"
        :prefill="prefill"
        :proposal-id="proposalId"
        @saved="refresh()"
        @closed="closeDialog()"
      />
    </template>
    <template #headword-cell="{ row }">
      <span class="font-semibold text-highlighted">{{ row.headword || '(bez naslovne riječi)' }}</span>
    </template>
    <template #entryStatus-cell="{ row }">
      {{ ENTRY_STATUS_LABELS[row.entryStatus] ?? row.entryStatus }}
    </template>
    <template #status-cell="{ row }">
      <div class="flex flex-wrap gap-2">
        <UBadge
          :label="wordStatusLabel(row)"
          :color="row.status === 'published' ? 'success' : row.status === 'draft' ? 'neutral' : 'warning'"
          variant="subtle"
        />
        <UBadge
          v-if="row.status === 'published'"
          :label="readiness(row).label"
          :color="readiness(row).color"
          variant="subtle"
        />
      </div>
    </template>
  </AdminResourcePage>
</template>
