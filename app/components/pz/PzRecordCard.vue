<script setup lang="ts">
// A record with just enough to choose it: picture, title, where and what, and how far it can be trusted.
// One link whose name is the title; no second link or button inside. The label row has a fixed order:
// sample label, verification stamp, mini protection plaque. Thumbnails are decorative (empty alt).
// `kind` leads on the no-image variant. `tall` puts the photograph on top from 1024px, for three-column grids.

const props = defineProps<{
  to: string
  title: string
  /** "Kalnik · sakralna građevina" */
  sub?: string
  /** Photograph; an icon stands in when missing. */
  image?: string
  icon?: string
  /** Leads on a card without an image: "Priča", "Običaj". */
  kind?: string
  sample?: boolean
  verification?: 'pend' | 'ok' | 'warn'
  protection?: { status: 'z' | 'p' | 'u', number?: string }
  tall?: boolean
}>()

const noImage = computed(() => !props.image && !props.icon)
</script>

<template>
  <NuxtLink
    :to="to"
    class="group grid min-w-0 gap-3 rounded-lg border border-default bg-default p-3 text-default no-underline hover:border-accented"
    :class="[
      noImage ? 'grid-cols-[minmax(0,1fr)]' : 'grid-cols-[6rem_minmax(0,1fr)]',
      tall && 'lg:grid-cols-[minmax(0,1fr)] lg:overflow-hidden lg:p-0'
    ]"
    data-testid="record-card"
    :data-variant="noImage ? 'noimg' : tall ? 'tall' : 'thumb'"
  >
    <div
      v-if="!noImage"
      class="relative grid size-24 place-items-center overflow-hidden rounded-md bg-elevated text-muted"
      :class="tall && 'lg:aspect-[16/10] lg:size-auto lg:w-full lg:rounded-none'"
      aria-hidden="true"
    >
      <img
        v-if="image"
        :src="image"
        alt=""
        loading="lazy"
        class="size-full object-cover"
      >
      <UIcon
        v-else
        :name="icon!"
        class="size-8"
      />
    </div>
    <div
      class="flex min-w-0 flex-col gap-1"
      :class="tall && 'lg:px-4 lg:pb-4'"
    >
      <span
        v-if="noImage && kind"
        class="pz-overline text-muted"
      >{{ kind }}</span>
      <span class="font-display text-lg/[1.25] font-bold hyphens-auto group-hover:underline group-hover:underline-offset-[3px]">{{ title }}</span>
      <span
        v-if="sub"
        class="text-sm text-muted"
      >{{ sub }}</span>
      <span
        v-if="sample || verification || protection"
        class="mt-auto flex flex-wrap gap-1.5 pt-1"
        data-testid="record-card-labels"
      >
        <PzSampleLabel v-if="sample" />
        <PzVerificationStamp
          v-if="verification"
          :state="verification"
        />
        <PzProtectionPlaque
          v-if="protection"
          v-bind="protection"
          mini
        />
      </span>
    </div>
  </NuxtLink>
</template>
