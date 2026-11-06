<script setup lang="ts">
// Short forms and choices that open over the page (Predloži ispravak, Dodaj izvor, Kod nas se kaže drugačije).
// One wrapper picks the Nuxt UI container by breakpoint: a bottom drawer below 1024px, a 520px modal from 1024px up.
// The consumer provides the title, a one-line context, the form (default slot) and its own submit handler.
// `content` passes through to the dialog content (onOpenAutoFocus, onEscapeKeyDown, ...).
const props = defineProps<{
  title: string
  /** One line naming the entry, and saying an editor reviews every suggestion before it is published. */
  context?: string
  /** Typed text the visitor would lose: closing by Esc, scrim, swipe or the close button asks first. */
  dirty?: boolean
  content?: Record<string, unknown>
}>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const desktop = usePzDesktop()

// Only dismissals from the sheet itself ask. The consumer closing it (Cancel, after a send) just closes.
function onUpdateOpen(value: boolean) {
  if (!value && props.dirty && !window.confirm(t('pz.kit.sheet.discard'))) return
  open.value = value
}

const closeButton = computed(() => ({
  'aria-label': t('pz.kit.sheet.close'),
  'class': 'size-11 justify-center'
}))

const shared = {
  title: 'pz-h3 text-highlighted',
  description: 'pz-body-sm text-muted',
  header: 'items-start gap-2 border-0 pb-0',
  body: 'overflow-y-auto',
  footer: 'sticky bottom-0 border-t border-default bg-elevated pb-[calc(1rem+env(safe-area-inset-bottom))]'
}
</script>

<template>
  <UModal
    v-if="desktop"
    :open="open"
    :title="title"
    :description="context"
    :content="content"
    :close="closeButton"
    :ui="{
      ...shared,
      content: 'max-w-[520px] rounded-(--pz-radius-xl) border border-accented bg-elevated shadow-[var(--pz-shadow-sheet)]'
    }"
    data-testid="pz-sheet-modal"
    @update:open="onUpdateOpen"
  >
    <template #body>
      <slot />
    </template>
    <template
      v-if="$slots.footer"
      #footer
    >
      <slot name="footer" />
    </template>
  </UModal>
  <UDrawer
    v-else
    direction="bottom"
    :open="open"
    :title="title"
    :description="context"
    :content="content"
    :close="closeButton"
    :ui="{
      ...shared,
      content: 'rounded-t-(--pz-radius-xl) border border-b-0 border-accented bg-elevated shadow-[var(--pz-shadow-sheet)]',
      handle: 'bg-(--ui-border-accented)',
      container: 'max-w-none'
    }"
    data-testid="pz-sheet-drawer"
    @update:open="onUpdateOpen"
  >
    <template #body>
      <slot />
    </template>
    <template
      v-if="$slots.footer"
      #footer
    >
      <slot name="footer" />
    </template>
  </UDrawer>
</template>
