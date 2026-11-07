<script setup lang="ts">
// A challenge or a result leaving the app, in a bottom sheet (a 520px modal from 1024px up) on PzBottomSheet.
// Title, one line of context, the prepared message (when `preview` is set) and the share actions.
// Consumer provides: `title`, `message`, `url`, an optional `context` (who plays, until when).
defineProps<{
  title: string
  context?: string
  /** The plain-text message WhatsApp and Viber carry. */
  message: string
  url: string
  /** Show the message above the actions, as for a result, where the square row is the content. */
  preview?: boolean
  prefix?: string
}>()
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <PzBottomSheet
    v-model:open="open"
    :title="title"
    :context="context"
  >
    <div class="flex min-w-0 flex-col gap-4">
      <pre
        v-if="preview"
        class="pz-body-sm m-0 rounded-(--pz-radius-md) border border-default bg-default p-3 font-sans wrap-anywhere whitespace-pre-wrap"
        lang="hr"
        data-testid="pz-share-text"
      >{{ message }}</pre>
      <PzShareActions
        :prefix="prefix ?? 'share'"
        :message="message"
        :url="url"
        :share-data="{ title, text: message }"
      />
    </div>
  </PzBottomSheet>
</template>
