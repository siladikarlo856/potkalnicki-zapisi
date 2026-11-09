<script setup lang="ts">
// One heritage item in a list. The whole card is one link whose accessible name is the title: the link is an
// overlay over the card, labelled by the title, so the badges stay readable text and the focus ring wraps the card.
// Verification and protection are the consumer's: put the trust badges in the `trust` slot, and the protection
// tag only when the item is legally protected.
defineProps<{
  title: string
  to: string
  settlement?: string
  municipality?: string
  /** A line or two of what the record says (an excerpt), under the place. */
  description?: string
  category?: string
  /** Lucide icon for the category tile, used when there is no photo. */
  icon?: string
  /** A photo, shown 4:3 in place of the tile. */
  image?: string
  /** The photo's one-line credit ("Foto: Autor, CC BY-SA 4.0"), shown under it. */
  imageCredit?: string
}>()

const titleId = useId()
</script>

<template>
  <article
    class="group relative grid grid-cols-[3rem_minmax(0,1fr)] gap-3 rounded-(--pz-radius-lg) border border-default bg-default p-4 pe-11 text-default hover:border-accented hover:shadow-[var(--pz-shadow-lift)]"
    data-testid="pz-heritage-card"
  >
    <div
      v-if="image"
      class="col-span-2 flex flex-col gap-1"
    >
      <img
        :src="image"
        alt=""
        loading="lazy"
        class="aspect-4/3 w-full rounded-(--pz-radius-lg) bg-elevated object-cover"
      >
      <p
        v-if="imageCredit"
        class="pz-caption font-normal text-dimmed"
        data-testid="pz-heritage-card-credit"
      >
        {{ imageCredit }}
      </p>
    </div>
    <span
      v-else
      class="grid size-12 place-items-center rounded-(--pz-radius-md) bg-accented text-primary"
      aria-hidden="true"
    >
      <UIcon
        :name="icon ?? 'i-lucide-landmark'"
        class="size-6"
      />
    </span>

    <div
      class="flex min-w-0 flex-col gap-2"
      :class="{ 'col-span-2': image }"
    >
      <h3
        :id="titleId"
        class="pz-h3 wrap-anywhere text-highlighted"
      >
        {{ title }}
      </h3>
      <p
        v-if="settlement || municipality"
        class="pz-body-sm flex flex-wrap items-center gap-1.5 text-muted"
      >
        <UIcon
          name="i-lucide-map-pin"
          class="size-4 shrink-0"
          aria-hidden="true"
        />
        <span>{{ [settlement, municipality].filter(Boolean).join(', ') }}</span>
      </p>
      <p
        v-if="description"
        class="pz-body-sm line-clamp-3 text-default"
      >
        {{ description }}
      </p>
      <div
        v-if="$slots.trust || category"
        class="flex flex-wrap items-center gap-2"
      >
        <slot name="trust" />
        <UBadge
          v-if="category"
          :label="category"
          color="neutral"
          variant="subtle"
          class="rounded-(--pz-radius-sm)"
        />
      </div>
    </div>

    <UIcon
      name="i-lucide-chevron-right"
      class="absolute end-4 top-4 size-5 text-dimmed"
      aria-hidden="true"
    />
    <NuxtLink
      :to="to"
      :aria-labelledby="titleId"
      class="absolute inset-0 rounded-(--pz-radius-lg)"
    />
  </article>
</template>
