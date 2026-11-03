<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ChallengeTemplate, ChallengeTemplateContent } from '~~/shared/utils/content/challengeTemplate'
import { CHALLENGE_LIMITS, challengeSummary, validateChallengeTemplate } from '~~/shared/utils/content/challengeTemplate'

definePageMeta({ layout: 'admin', middleware: 'admin' })
defineI18nRoute({ locales: ['hr'] })
useSeoMeta({ title: 'Izazovi', robots: 'noindex, nofollow' })

interface ChallengeTemplateForm {
  name: string
  content: ChallengeTemplateContent
  isCurrent: boolean
}

const CURRENT_LOCK = 'Ovo je trenutni izazov. Najprije postavi drugi izazov kao trenutni.'

const api = useAdminContentApi<ChallengeTemplate>('challenge_template')
const toast = useToast()
const confirm = useAdminConfirm()

async function makeCurrent(template: ChallengeTemplate, refresh: () => Promise<void>) {
  if (!await confirm({
    title: `Postaviti „${template.name}” kao trenutni izazov?`,
    description: 'Svi novi izazovi koristit će ova pitanja. Već pokrenuti izazovi zadržavaju svoja.',
    confirmLabel: 'Postavi kao trenutni'
  })) return
  try {
    await api.update(template.id, { isCurrent: true, revision: template.revision })
    toast.add({ title: 'Trenutni izazov je promijenjen', description: template.name, color: 'success', icon: 'i-lucide-trophy' })
  } catch (error) {
    toast.add({ title: 'Promjena nije uspjela', description: adminApiError(error).message, color: 'error' })
  }
  await refresh()
}

const resource = defineAdminResource<ChallengeTemplate, ChallengeTemplateForm>({
  kind: 'challenge_template',
  icon: 'i-lucide-trophy',
  labels: {
    title: 'Izazovi',
    description: 'Skupovi pitanja za izazove prijatelja. Svaki novi izazov kopira trenutni skup; već pokrenuti izazovi zadržavaju svoja pitanja.',
    create: 'Novi izazov',
    edit: 'Uredi izazov',
    empty: 'Još nema izazova.',
    search: 'Pretraži izazove'
  },
  columns: [
    { key: 'name', label: 'Naziv', sort: 'name' },
    { key: 'isCurrent', label: 'Trenutni', sort: 'isCurrent' },
    { key: 'summary', label: 'Pitanja', hideBelow: 'sm' },
    { key: 'title', label: 'Naslov za igrače', hideBelow: 'lg' }
  ],
  defaultSort: 'name',
  dialogWidth: 'wide',
  blank: () => ({ name: '', content: blankChallengeTemplateContent(), isCurrent: false }),
  // A copy, so editing never touches the loaded entity (the dialog compares against it).
  toForm: template => ({ name: template.name, content: JSON.parse(JSON.stringify(template.content)), isCurrent: template.isCurrent }),
  validate: form => validateChallengeTemplate(form).issues,
  label: template => template.name,
  lockedReason: template => template.isCurrent ? CURRENT_LOCK : undefined,
  rowActions: (template, { refresh }): DropdownMenuItem[] => template.isCurrent || template.status !== 'published'
    ? []
    : [{ label: 'Postavi kao trenutni', icon: 'i-lucide-trophy', onSelect: () => makeCurrent(template, refresh) }]
})

function questions(template: ChallengeTemplate) {
  const { rounds, questions } = challengeSummary(template.content)
  return `${rounds} ${rounds === 1 ? 'krug' : rounds < 5 ? 'kruga' : 'krugova'} · ${questions} ${questions % 10 === 1 && questions % 100 !== 11 ? 'pitanje' : 'pitanja'}`
}
</script>

<template>
  <AdminResourcePage :resource="resource">
    <template #isCurrent-cell="{ row }">
      <UBadge
        v-if="row.isCurrent"
        label="Trenutni"
        icon="i-lucide-trophy"
        color="primary"
        variant="subtle"
      />
      <span
        v-else
        class="text-dimmed"
      >—</span>
    </template>
    <template #summary-cell="{ row }">
      <span class="whitespace-nowrap">{{ questions(row) }}</span>
      <UBadge
        v-if="row.content.sample"
        label="Uzorak"
        color="warning"
        variant="subtle"
        size="sm"
        class="ms-2"
      />
    </template>
    <template #title-cell="{ row }">
      <span class="block max-w-xs truncate">{{ row.content.title.hr }}</span>
    </template>

    <template #fields="{ state, entity }">
      <UFormField
        name="name"
        label="Naziv"
        description="Za administraciju; igrači vide naslov izazova."
        required
      >
        <UInput
          v-model="state.name"
          :maxlength="CHALLENGE_LIMITS.name"
          class="w-full"
          autofocus
        />
      </UFormField>

      <UFormField
        name="isCurrent"
        :description="entity?.isCurrent
          ? 'Novi izazovi koriste ovaj skup. Da ga zamijeniš, postavi drugi izazov kao trenutni.'
          : 'Novi izazovi koristit će ovaj skup čim se objavi. Dosadašnji trenutni izazov prestaje to biti.'"
      >
        <USwitch
          v-model="state.isCurrent"
          label="Trenutni izazov"
          :disabled="entity?.isCurrent"
        />
      </UFormField>

      <USeparator />

      <AdminChallengeTemplateEditor v-model="state.content" />
    </template>
  </AdminResourcePage>
</template>
