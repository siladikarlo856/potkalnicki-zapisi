<script setup lang="ts">
import { pzRoutes } from '~~/shared/utils/appRoutes'

// One address, several states (20-screens.md, Igra): loading (`ucitavanje`), failed (`greska`), not enough content
// (`prazno`), the start page (`pocetak`, default slot `start`) and the round. The round and the result are drawn
// by the slot `round`, which brings its own focus shell; everything before it sits in the normal page.
defineProps<{
  title: string
  lead?: string
  loading?: boolean
  error?: boolean
  empty?: boolean
  /** The round has started: only the `round` slot is shown. */
  started?: boolean
  emptyDescription?: string
}>()
defineEmits<{ retry: [] }>()
const localePath = useLocalePath()
</script>

<template>
  <slot
    v-if="started"
    name="round"
  />
  <UContainer
    v-else
    class="py-6 sm:py-10"
  >
    <div class="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-2">
      <PageState
        v-if="error"
        kind="error"
        title="Pitanja nismo uspjeli učitati"
        description="Nije do tebe. Provjeri vezu i pokušaj ponovno."
        data-testid="game-error"
        @retry="$emit('retry')"
      />
      <PageState
        v-else-if="empty && !loading"
        kind="empty"
        title="Ova igra još nema dovoljno pitanja"
        :description="emptyDescription ?? 'Za ovu igru treba više provjerenih zapisa. Dotad pokušaj neku drugu igru ili pomozi dodati zapise.'"
        data-testid="game-empty"
      >
        <template #actions>
          <UButton
            :to="localePath(pzRoutes.games)"
            label="Druge igre"
          />
          <UButton
            :to="localePath(pzRoutes.contribute)"
            label="Predloži zapis"
            color="neutral"
            variant="outline"
          />
        </template>
      </PageState>
      <template v-else>
        <PageHead
          :title="title"
          :lead="lead"
        />
        <Skeleton
          v-if="loading"
          :lines="4"
          block
          label="Pripremamo pitanja…"
          data-testid="game-loading"
        />
        <slot
          v-else
          name="start"
        />
      </template>
    </div>
  </UContainer>
</template>
