<script setup lang="ts">
// One dialect word in the dictionary list, "Riječi iz ovog sela" and "Slične riječi". One link; its accessible
// name is the headword. The card never lists the variants: they belong on the word page. On a settlement page the
// variants line is replaced by the local form as a highlighted place chip ("Ovdje: …").
const props = defineProps<{
  headword: string
  to: string
  /** Word type, shown in italic serif beside the headword ("imenica"). */
  type?: string
  meaning?: string
  variantCount?: number
  settlementCount?: number
  /** The form said in the settlement being viewed. */
  localForm?: string
  sample?: boolean
}>()

const { t } = useI18n()
const count = usePzCount()
const headId = useId()

const summary = computed(() => {
  if (props.variantCount === undefined) return ''
  const parts = [count('pz.kit.cards.forms', props.variantCount)]
  if (props.settlementCount !== undefined) parts.push(count('pz.kit.cards.villages', props.settlementCount))
  return parts.join(' · ')
})
</script>

<template>
  <article
    class="relative flex flex-col gap-2 rounded-(--pz-radius-lg) border border-default bg-default p-4 pe-11 text-default hover:border-accented hover:shadow-[var(--pz-shadow-lift)]"
    data-testid="pz-word-card"
  >
    <h3
      :id="headId"
      class="flex flex-wrap items-baseline gap-x-2 text-highlighted"
    >
      <span
        class="font-serif text-[28px]/8 font-bold wrap-anywhere"
        lang="hr"
      >{{ headword }}</span>
      <span
        v-if="type"
        class="font-serif text-sm/5 font-normal text-muted italic"
        lang="hr"
      >{{ type }}</span>
      <HeritageSampleBadge v-if="sample" />
    </h3>
    <p
      v-if="meaning"
      class="pz-body"
    >
      {{ meaning }}
    </p>
    <p
      v-if="localForm"
      class="pz-body-sm"
    >
      <span class="inline-flex items-center gap-1.5 rounded-(--pz-radius-sm) bg-accented px-2 py-1 font-medium text-highlighted">
        <UIcon
          name="i-lucide-map-pin"
          class="size-4 shrink-0 text-primary"
          aria-hidden="true"
        />
        <span lang="hr">{{ t('pz.kit.cards.here', { form: localForm }) }}</span>
      </span>
    </p>
    <p
      v-else-if="summary"
      class="pz-body-sm text-muted"
    >
      {{ summary }}
    </p>

    <UIcon
      name="i-lucide-chevron-right"
      class="absolute end-4 top-4 size-5 text-dimmed"
      aria-hidden="true"
    />
    <NuxtLink
      :to="to"
      :aria-labelledby="headId"
      class="absolute inset-0 rounded-(--pz-radius-lg)"
    />
  </article>
</template>
