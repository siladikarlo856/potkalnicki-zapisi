<script setup lang="ts">
// The screen's next action in thumb reach: Dalje, a form's submit, Kreni. Mobile only; on desktop the same
// buttons sit in the side panel or under the question. The consumer puts one or two buttons in the slot,
// the primary last (on the right); each takes an equal share of the bar.
const bar = useTemplateRef<HTMLElement>('bar')

// Focused fields must never hide behind the bar: while it is shown, the page's scroll-padding-bottom
// (set in main.css from --pz-actionbar-h) is as tall as the bar.
onMounted(() => {
  const element = bar.value
  if (!element || typeof ResizeObserver === 'undefined') return
  const root = document.documentElement
  const observer = new ResizeObserver(() => {
    root.style.setProperty('--pz-actionbar-h', `${element.offsetHeight}px`)
  })
  observer.observe(element)
  onScopeDispose(() => {
    observer.disconnect()
    root.style.removeProperty('--pz-actionbar-h')
  })
})
</script>

<template>
  <div
    ref="bar"
    data-testid="pz-sticky-action-bar"
    class="sticky bottom-0 z-20 flex items-center gap-2 border-t border-accented bg-default px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[var(--pz-shadow-sheet)] lg:hidden print:hidden *:min-w-0 *:flex-1 *:justify-center"
  >
    <slot />
  </div>
</template>
