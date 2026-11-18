<script setup lang="ts">
// Zaštita: is the object entered in the Registar kulturnih dobara? Square on purpose, never a pill and never
// a UBadge: the pill shape belongs to PzVerificationStamp. Always render it on a heritage record, including
// "nepoznato": an absent plaque would read as "not protected", which we do not know.
const props = defineProps<{
  status: 'z' | 'p' | 'u'
  /** The register number exactly as in the register (Z-1234, P-5678). */
  number?: string
  /** Full width, inside the facts panel. */
  block?: boolean
  /** Shield cell and number only, for list cards and tables. Not used for "nepoznato". */
  mini?: boolean
  /** Link to the register entry, when the address is known. */
  href?: string
}>()

const STATUSES = {
  z: { title: 'Zaštićeno kulturno dobro', icon: 'i-lucide-shield-check', box: 'border-(--pz-prot)', cell: 'bg-(--pz-prot) text-(--pz-on-prot)' },
  p: { title: 'Preventivno zaštićeno', icon: 'i-lucide-shield-half', box: 'border-(--pz-prot) border-dashed', cell: 'bg-(--pz-prot-bg) text-(--pz-prot)' },
  u: { title: 'Zaštita: nepoznato', icon: 'i-lucide-shield-question', box: 'border-accented', cell: 'bg-elevated text-muted' }
} as const

const current = computed(() => STATUSES[props.status])
const registerLine = computed(() => props.status === 'u' ? 'Nema podatka u registru' : `Registar: ${props.number ?? ''}`.trim())
const mini = computed(() => props.mini && props.status !== 'u')
</script>

<template>
  <component
    :is="href ? 'a' : block ? 'div' : 'span'"
    :href="href"
    class="items-stretch overflow-hidden rounded-xs border-[1.5px] bg-default text-[0.8125rem]/[1.3] text-default"
    :class="[current.box, block && !mini ? 'flex' : 'inline-flex', href && 'no-underline hover:[&_b]:underline']"
    :data-testid="`protection-plaque-${status}`"
    :data-state="status"
  >
    <span
      class="flex items-center border-r border-inherit px-2"
      :class="current.cell"
    >
      <UIcon
        :name="current.icon"
        class="size-5"
        aria-hidden="true"
      />
    </span>
    <template v-if="mini">
      <span class="flex items-center px-2.5 py-[3px] font-bold tabular-nums">
        <span class="sr-only">{{ current.title }}, </span>{{ number }}
      </span>
    </template>
    <span
      v-else
      class="flex min-w-0 flex-col justify-center px-2.5 py-[5px]"
    >
      <b class="text-sm font-bold">{{ current.title }}</b>
      <span class="tracking-wide text-muted tabular-nums">{{ registerLine }}</span>
    </span>
  </component>
</template>
