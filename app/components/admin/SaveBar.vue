<script setup lang="ts">
import type { ContentStatus } from '~~/shared/utils/content/common'

// The bar at the bottom of the editor: whether the record is public, whether it is saved, and the actions (at most three,
// the primary last). The message is a polite live region; a failure is assertive. Never publishes by itself.
export type SaveBarState = 'saved' | 'unsaved' | 'saving' | 'just-saved' | 'errors' | 'conflict' | 'failed' | 'archived' | 'new'
export interface SaveBarAction {
  key: string
  label: string
  variant: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
  busy?: boolean
}
const props = defineProps<{
  status?: ContentStatus
  state: SaveBarState
  /** Changed fields (unsaved) or fields to correct (errors). */
  count?: number
  /** A published record with newer saved edits. */
  unpublishedChanges?: boolean
  /** "Objavljeno 3. listopada 2026.": who and when, set when it is known. */
  published?: string
  /** What the primary button is doing: "Spremam…", "Objavljujem…". */
  busyLabel?: string
  actions: SaveBarAction[]
}>()
const emit = defineEmits<{ action: [key: string] }>()

const message = computed(() => {
  const count = props.count ?? 0
  switch (props.state) {
    case 'new': return { text: 'Još nije spremljeno', icon: 'i-lucide-circle-dashed', tone: '' }
    case 'saved': return { text: 'Sve je spremljeno', icon: 'i-lucide-check', tone: '' }
    case 'just-saved': return { text: props.status === 'published' ? 'Objavljeno maloprije' : 'Spremljeno maloprije', icon: 'i-lucide-check', tone: '' }
    case 'saving': return { text: props.busyLabel ?? 'Spremam…', icon: 'i-lucide-loader-circle', tone: '' }
    case 'unsaved': return { text: `Nespremljene izmjene u ${count} ${nounFor(count, ['polju', 'polja', 'polja'])}`, icon: 'i-lucide-pencil', tone: 'text-warning' }
    case 'errors': return { text: `${count} ${nounFor(count, ['polje', 'polja', 'polja'])} treba ispraviti`, icon: 'i-lucide-circle-alert', tone: 'text-error' }
    case 'conflict': return { text: 'Sukob inačica: nije spremljeno', icon: 'i-lucide-git-compare', tone: 'text-warning' }
    case 'failed': return { text: 'Nije spremljeno. Izmjene su sačuvane u pregledniku.', icon: 'i-lucide-circle-alert', tone: 'text-error' }
    default: return { text: 'Samo za čitanje', icon: 'i-lucide-lock', tone: '' }
  }
})
const assertive = computed(() => props.state === 'failed' || props.state === 'errors')
</script>

<template>
  <div
    class="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-default bg-default px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    data-testid="admin-save-bar"
    :data-state="state"
  >
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <span class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <PzStatusBadge
          :status="status ?? 'draft'"
          :unpublished-changes="unpublishedChanges"
        />
        <span
          class="inline-flex items-center gap-1.5 text-sm font-bold"
          :class="message.tone"
          :role="assertive ? 'alert' : 'status'"
          :aria-live="assertive ? 'assertive' : 'polite'"
          data-testid="admin-save-message"
        >
          <UIcon
            :name="message.icon"
            class="size-4 shrink-0"
            :class="state === 'saving' ? 'animate-spin' : ''"
            aria-hidden="true"
          />{{ message.text }}
        </span>
      </span>
      <span
        v-if="published"
        class="text-xs text-muted"
      >{{ published }}</span>
    </div>
    <div class="flex flex-wrap items-center justify-end gap-2 max-md:w-full max-md:[&>*]:flex-1">
      <UButton
        v-for="action in actions"
        :key="action.key"
        :label="action.busy && busyLabel ? busyLabel : action.label"
        :color="action.variant === 'primary' ? 'primary' : 'neutral'"
        :variant="action.variant === 'primary' ? 'solid' : action.variant === 'secondary' ? 'outline' : 'ghost'"
        :loading="action.busy"
        :disabled="action.disabled"
        :data-testid="`admin-save-${action.key}`"
        @click="emit('action', action.key)"
      />
    </div>
  </div>
</template>
