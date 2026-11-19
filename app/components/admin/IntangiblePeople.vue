<script setup lang="ts">
import { INTANGIBLE_MAX, NARRATOR_ROLES, NARRATOR_ROLE_LABELS } from '#shared/utils/content/intangible'
import type { NarratorLink, NarratorRole } from '#shared/utils/content/intangible'

// Who told a record (Kazivač) and who wrote it down (Zapisivač), both Narrator records, and, only for a literary
// retelling, its author, a Person. How a narrator is named in public is the Narrator record's own business.
const props = defineProps<{
  narrators: NarratorLink[]
  authorIds: string[]
}>()
const emit = defineEmits<{
  'update:narrators': [NarratorLink[]]
  'update:authorIds': [string[]]
}>()

const roleOptions = NARRATOR_ROLES.map(value => ({ label: NARRATOR_ROLE_LABELS[value], value }))
const full = computed(() => props.narrators.length >= INTANGIBLE_MAX.narrators)

function add() {
  if (!full.value) emit('update:narrators', [...props.narrators, { narratorId: '', role: 'narrator' }])
}

function update(index: number, partial: Partial<NarratorLink>) {
  emit('update:narrators', props.narrators.map((link, position) => position === index ? { ...link, ...partial } : link))
}

function remove(index: number) {
  emit('update:narrators', props.narrators.filter((_, position) => position !== index))
}
</script>

<template>
  <fieldset class="flex flex-col gap-4">
    <legend class="mb-2 text-sm font-semibold text-highlighted">
      Ljudi
    </legend>

    <div class="flex flex-col gap-2">
      <div>
        <p class="text-sm font-medium text-highlighted">
          Kazivači i zapisivači
        </p>
        <p class="text-sm text-muted">
          Kazivač je ispričao ili otpjevao, zapisivač je zapisao. Isti kazivač može biti oboje. Javnost vidi ime samo ako
          kazivač ima pristanak, inače njegov javni opis.
        </p>
      </div>
      <AdminFormField
        v-for="(link, index) in narrators"
        :key="index"
        :name="`narrators.${index}.narratorId`"
      >
        <div class="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <AdminLookupSelect
            :model-value="link.narratorId || null"
            endpoint="/api/admin/lookup/narrator"
            placeholder="Kazivač"
            @update:model-value="update(index, { narratorId: $event ?? '' })"
          />
          <USelect
            :model-value="link.role"
            :items="roleOptions"
            class="w-full min-w-40"
            :aria-label="`Uloga kazivača ${index + 1}`"
            @update:model-value="value => update(index, { role: value as NarratorRole })"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            type="button"
            aria-label="Ukloni kazivača"
            @click="remove(index)"
          />
        </div>
      </AdminFormField>
      <div class="flex flex-wrap items-center gap-3">
        <UButton
          label="Dodaj kazivača ili zapisivača"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          size="sm"
          type="button"
          :disabled="full"
          data-test="admin-add-narrator"
          @click="add"
        />
        <ULink
          to="/admin/kazivaci?novo=1"
          target="_blank"
          class="text-sm text-primary underline underline-offset-2"
        >
          Novi kazivač (nova kartica)
        </ULink>
      </div>
    </div>

    <AdminFormField
      name="authorIds"
      label="Autori (samo za književne prepriče)"
      optional
      description="Povijesne osobe koje su tekst napisale. Narodni tekstovi nemaju autora."
    >
      <AdminLookupList
        :model-value="authorIds"
        endpoint="/api/admin/lookup/person"
        placeholder="Dodaj autora"
        empty="Nema autora."
        noun="autora"
        :max="INTANGIBLE_MAX.authors"
        @update:model-value="emit('update:authorIds', $event)"
      />
    </AdminFormField>
  </fieldset>
</template>
