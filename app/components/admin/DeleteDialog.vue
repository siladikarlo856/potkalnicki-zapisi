<script setup lang="ts" generic="T extends ContentEntity">
import type { ContentEntity, ContentReferences } from '~~/shared/utils/content/common'
import type { AdminResource } from '~/composables/useAdminResource'

// Delete with references: lists what refers to the entity first. While something blocks a hard
// delete, archiving (hidden publicly, links and history kept) is the only action offered.
const props = defineProps<{
  resource: Pick<AdminResource<T>, 'kind' | 'label'>
  entity: T | null
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ done: [mode: 'archive' | 'hard'] }>()

const api = useAdminContentApi<T>(props.resource.kind)
const toast = useToast()
const references = ref<ContentReferences | null>(null)
const loading = ref(false)
const busy = ref<'archive' | 'hard' | null>(null)
const failure = ref('')

async function load() {
  if (!props.entity) return
  loading.value = true
  failure.value = ''
  references.value = null
  try {
    references.value = await api.references(props.entity.id)
  } catch (error) {
    failure.value = adminApiError(error).message
  } finally {
    loading.value = false
  }
}

watch(() => [open.value, props.entity?.id] as const, ([isOpen]) => {
  if (isOpen) load()
}, { immediate: true })

const blocked = computed(() => references.value?.blocking ?? false)
const archived = computed(() => props.entity?.status === 'archived')

async function run(mode: 'archive' | 'hard') {
  if (!props.entity) return
  busy.value = mode
  failure.value = ''
  try {
    if (mode === 'archive') await api.archive(props.entity.id)
    else await api.remove(props.entity.id)
    toast.add({
      title: mode === 'archive' ? 'Arhivirano' : 'Trajno obrisano',
      description: props.resource.label(props.entity),
      color: 'success',
      icon: mode === 'archive' ? 'i-lucide-archive' : 'i-lucide-trash-2'
    })
    emit('done', mode)
    open.value = false
  } catch (error) {
    const problem = adminApiError(error)
    failure.value = problem.message
    if (problem.references) references.value = problem.references
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="entity ? `Obrisati „${resource.label(entity)}”?` : 'Obrisati zapis?'"
    :ui="{ footer: 'flex-wrap justify-end' }"
    data-test="admin-delete-dialog"
  >
    <template #body>
      <div class="flex flex-col gap-4 text-sm">
        <div
          v-if="loading"
          class="flex flex-col gap-2"
          aria-busy="true"
        >
          <USkeleton class="h-5 w-2/3" />
          <USkeleton class="h-5 w-1/2" />
        </div>
        <template v-else-if="references">
          <div
            v-if="references.groups.length"
            class="flex flex-col gap-3"
            data-test="admin-delete-references"
          >
            <p class="text-highlighted">
              Na ovaj zapis upućuje:
            </p>
            <div
              v-for="group in references.groups"
              :key="group.kind"
            >
              <p class="font-medium">
                {{ group.label }}: {{ group.count }}
              </p>
              <ul class="mt-1 list-disc ps-5 text-muted">
                <li
                  v-for="item in group.items"
                  :key="item.id"
                >
                  <ULink
                    v-if="item.to"
                    :to="item.to"
                    class="text-primary"
                  >
                    {{ item.label }}
                  </ULink>
                  <span v-else>{{ item.label }}</span>
                </li>
                <li v-if="group.count > group.items.length">
                  … i još {{ group.count - group.items.length }}
                </li>
              </ul>
            </div>
          </div>
          <p
            v-else
            class="text-muted"
          >
            Ništa ne upućuje na ovaj zapis.
          </p>
          <p
            v-if="blocked"
            class="text-highlighted"
            data-test="admin-delete-blocked"
          >
            Zapis se koristi pa se ne može trajno obrisati. Arhiviraj ga: neće se prikazivati javno, a poveznice i povijest ostaju.
          </p>
        </template>
        <UAlert
          v-if="failure"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="failure"
          role="alert"
        />
        <p class="text-xs text-muted">
          Svaka promjena bilježi se u povijesti zapisa.
        </p>
      </div>
    </template>

    <template #footer>
      <UButton
        label="Odustani"
        color="neutral"
        variant="ghost"
        :disabled="!!busy"
        @click="open = false"
      />
      <UButton
        v-if="!archived"
        label="Arhiviraj"
        icon="i-lucide-archive"
        :color="blocked ? 'primary' : 'neutral'"
        :variant="blocked ? 'solid' : 'outline'"
        :loading="busy === 'archive'"
        :disabled="loading || !!busy || !references"
        data-test="admin-archive"
        @click="run('archive')"
      />
      <UButton
        label="Trajno obriši"
        icon="i-lucide-trash-2"
        color="error"
        :variant="blocked ? 'ghost' : 'solid'"
        :loading="busy === 'hard'"
        :disabled="loading || !!busy || !references || blocked"
        data-test="admin-hard-delete"
        @click="run('hard')"
      />
    </template>
  </UModal>
</template>
