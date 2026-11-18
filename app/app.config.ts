export default defineAppConfig({
  ui: {
    colors: {
      primary: 'bukva',
      success: 'bukva',
      warning: 'oker',
      error: 'crvena',
      neutral: 'kamen',
      secondary: 'kamen',
      info: 'kamen'
    },
    button: {
      slots: { base: 'font-bold rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--pz-focus)' },
      variants: { size: { xl: { base: 'px-4.5 py-2.5 text-base gap-2' } } },
      compoundVariants: [
        { color: 'primary', variant: 'solid', class: 'hover:bg-(--pz-primary-hover) active:bg-(--pz-primary-hover) outline-(--pz-focus)' },
        { color: 'neutral', variant: 'outline', class: 'ring-[1.5px] ring-accented bg-default hover:bg-elevated hover:ring-inverted' }
      ]
    },
    input: { slots: { base: 'rounded-md ring-[1.5px] ring-accented focus-visible:ring-accented focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--pz-focus)' }, variants: { size: { xl: { base: 'px-3 py-2.5 text-base' } } } },
    textarea: { slots: { base: 'rounded-md ring-[1.5px] ring-accented focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--pz-focus)' } },
    select: { slots: { base: 'rounded-md ring-[1.5px] ring-accented focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--pz-focus)' } },
    formField: { slots: { label: 'font-bold text-[0.9375rem]', hint: 'text-sm text-muted', error: 'text-sm font-bold text-error', help: 'text-sm text-muted' } },
    card: { slots: { root: 'rounded-lg ring-1 ring-default shadow-none', body: 'p-4 sm:p-5' } },
    alert: { slots: { root: 'rounded-md', title: 'font-bold', description: 'text-default' }, defaultVariants: { variant: 'subtle', color: 'neutral' } },
    badge: {
      defaultVariants: { variant: 'soft', color: 'neutral' },
      compoundVariants: [{ color: 'primary', variant: 'subtle', class: 'text-(--ui-color-primary-800) dark:text-primary' }]
    },
    modal: { slots: { overlay: 'bg-(--pz-scrim)', content: 'rounded-xl bg-(--pz-raised)' } },
    drawer: { slots: { overlay: 'bg-(--pz-scrim)', content: 'rounded-t-xl bg-(--pz-raised)' } },
    slideover: { slots: { overlay: 'bg-(--pz-scrim)', content: 'bg-(--pz-raised) max-w-[520px]' } },
    toast: { slots: { root: 'rounded-md bg-inverted text-inverted ring-0', title: 'font-semibold text-inverted' } },
    skeleton: { base: 'rounded-sm bg-elevated' },
    progress: { slots: { base: 'bg-elevated', indicator: 'bg-primary' } },
    table: { slots: { th: 'text-[0.8125rem] font-bold text-muted bg-elevated', td: 'text-sm' } }
  },
  site: {
    // Named in the privacy notice for questions, corrections and deletion requests.
    privacyEmail: 'siladikarlo856@gmail.com'
  }
})
