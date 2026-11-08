<script setup lang="ts">
import type { InboxDetail } from '~~/shared/types/inbox'
import { CONTRIBUTION_KIND_LABELS } from '~~/shared/utils/contribution'

// Shown at the top of a content dialog opened from the inbox (`?prijedlog=<id>`): who sent the correction or
// proposal, what it changes (current → proposed, with the proposed value highlighted), and whether the
// contributor is credited when it is saved. The dialog sends `applySubmissionId` and `applyCredit` with the save.
const props = defineProps<{
  detail: InboxDetail
}>()
const credit = defineModel<boolean>('credit', { default: true })

const submission = computed(() => props.detail.submission)
const isCorrection = computed(() => submission.value.type === 'correction')
/** A Memory: the Draft is a Story, Custom or Folk text started from it; publishing the Draft applies it. */
const isMemory = computed(() => submission.value.type === 'memory')
const applied = computed(() => !!submission.value.appliedAt)
/** Sources carry no credits, and an anonymous contributor has no name to thank. */
const creditable = computed(() => !applied.value && !!submission.value.name && submission.value.targetKind !== 'source')
</script>

<template>
  <UAlert
    :color="applied ? 'neutral' : 'info'"
    variant="subtle"
    icon="i-lucide-git-pull-request"
    :title="`${isCorrection ? 'Ispravak' : isMemory ? 'Sjećanje' : 'Prijedlog novog zapisa'} #${submission.id}${submission.targetKind ? ` · ${CONTRIBUTION_KIND_LABELS[submission.targetKind]}` : ''}`"
    data-test="admin-proposal-banner"
  >
    <template #description>
      <div class="flex flex-col gap-3">
        <p
          v-if="applied"
          class="font-medium"
        >
          Ovaj prijedlog je već primijenjen.
        </p>
        <p
          v-else-if="isCorrection"
          class="text-sm"
        >
          Predložene vrijednosti su unesene u obrazac. Pregledaj ih i spremi: spremanje primjenjuje prijedlog i odobrava ga.
        </p>
        <p
          v-else-if="isMemory"
          class="text-sm"
          data-test="admin-memory-banner"
        >
          Skica počinje tekstom sjećanja. Dovrši je (vrstu, mjesta, kazivača i vrijeme) i objavi: objava odobrava sjećanje,
          a pošiljatelj se navodi u zahvalama samo ako je imenovan i dao privolu.
        </p>
        <p
          v-else
          class="text-sm"
        >
          Dovrši skicu i objavi je: objava odobrava prijedlog.
        </p>

        <UAlert
          v-if="detail.stale"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Zapis je izmijenjen nakon što je ispravak poslan."
          description="Provjeri trenutne vrijednosti prije spremanja."
          data-test="admin-proposal-stale"
        />

        <p class="whitespace-pre-line text-sm text-highlighted">
          {{ submission.text }}
        </p>

        <ul
          v-if="detail.changes.length"
          class="flex flex-col gap-2 text-sm"
        >
          <li
            v-for="change in detail.changes"
            :key="change.field"
            class="grid gap-1 sm:grid-cols-[10rem_1fr]"
          >
            <span class="text-muted">{{ change.label }}</span>
            <span class="flex flex-col gap-1">
              <span
                v-if="change.current"
                class="whitespace-pre-line break-words text-muted line-through"
              >{{ change.current }}</span>
              <mark class="whitespace-pre-line break-words rounded bg-primary/15 px-1 text-highlighted">{{ change.proposed }}</mark>
              <span
                v-if="isCorrection && !change.applicable"
                class="text-xs text-dimmed"
              >Samo za informaciju: ne mijenja se automatski.</span>
            </span>
          </li>
        </ul>

        <UCheckbox
          v-if="creditable"
          v-model="credit"
          :label="`Navedi doprinositelja (${submission.name})`"
          description="Ime se javno prikazuje kao zahvala. Povlačenjem privole uklanja se i iz povijesti."
          data-test="admin-proposal-credit"
        />
      </div>
    </template>
  </UAlert>
</template>
