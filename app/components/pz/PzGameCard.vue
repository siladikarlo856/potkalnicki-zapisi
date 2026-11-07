<script setup lang="ts">
// One game in the hub and in "Igraj" sections: a topic tile, the name in serif, one line on what you do, and a
// meta line with the question count and time. The whole card is one link, named by the title.
// Coming soon: a dashed edge on a muted ground, the "Uskoro" badge, no link, aria-disabled.
// Show one per unfinished topic, never a whole row of them.
const props = defineProps<{
  title: string
  blurb?: string
  /** Where the game lives. Left out (or with `soon`) the card is not a link. */
  to?: string
  questions?: number
  minutes?: number
  soon?: boolean
  sample?: boolean
  /** Lucide icon for the topic tile. */
  icon?: string
  /** Heading level of the title: h3 inside a section, h2 when the card stands directly under the page title. */
  level?: 2 | 3
}>()

const { t } = useI18n()
const count = usePzCount()
const titleId = useId()

const linked = computed(() => !props.soon && !!props.to)
const meta = computed(() => {
  const parts: string[] = []
  if (props.questions !== undefined) parts.push(count('pz.kit.cards.questions', props.questions))
  if (props.minutes !== undefined) parts.push(t('pz.kit.cards.minutes', { n: props.minutes }))
  return parts.join(' · ')
})
</script>

<template>
  <article
    class="relative flex min-h-38 flex-col gap-2 rounded-(--pz-radius-lg) border p-4 text-default"
    :class="soon
      ? 'border-dashed border-accented bg-muted text-muted'
      : 'border-default bg-default hover:border-accented hover:shadow-[var(--pz-shadow-lift)]'"
    :aria-disabled="soon ? 'true' : undefined"
    data-testid="pz-game-card"
  >
    <span
      class="grid size-10 place-items-center rounded-(--pz-radius-md) bg-accented text-primary"
      aria-hidden="true"
    >
      <UIcon
        :name="icon ?? 'i-lucide-gamepad-2'"
        class="size-5"
      />
    </span>
    <component
      :is="level === 2 ? 'h2' : 'h3'"
      :id="titleId"
      class="pz-h3 wrap-anywhere"
      :class="soon ? 'text-muted' : 'text-highlighted'"
    >
      {{ title }}
    </component>
    <p
      v-if="blurb"
      class="pz-body-sm text-muted"
    >
      {{ blurb }}
    </p>
    <p class="pz-caption mt-auto flex flex-wrap items-center gap-2 font-medium text-muted">
      <UBadge
        v-if="soon"
        :label="t('pz.kit.cards.soon')"
        color="neutral"
        variant="subtle"
        class="rounded-(--pz-radius-sm)"
      />
      <HeritageSampleBadge v-if="sample" />
      <span v-if="meta">{{ meta }}</span>
    </p>
    <NuxtLink
      v-if="linked"
      :to="to!"
      :aria-labelledby="titleId"
      class="absolute inset-0 rounded-(--pz-radius-lg)"
    />
  </article>
</template>
