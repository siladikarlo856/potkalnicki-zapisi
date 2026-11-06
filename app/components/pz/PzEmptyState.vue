<script setup lang="ts">
// How a page with little or no data stays inviting: say what we know, then ask for what we don't.
// A headline that names the place (never "Nema podataka"), one sentence asking specific questions, and
// contribution tiles that link to /doprinesi. "Što već znamo" sits below the card.
// The consumer provides the place in the locative case, the municipality, nearby settlements and the tiles.
export interface PzEmptyLink {
  label: string
  to: string
}
export interface PzEmptyContribution extends PzEmptyLink {
  icon?: string
}

defineProps<{
  /** The place in the locative case ("Šopronu"), as the headline reads "U Šopronu još skupljamo zapise." */
  placeName?: string
  /** A headline of its own, for uses that are not a thin place (an empty municipality tab, an empty filter). */
  title?: string
  /** Overrides the sentence that asks for specific things. */
  description?: string
  municipality?: string
  nearby?: PzEmptyLink[]
  contributeTypes?: PzEmptyContribution[]
}>()

const { t } = useI18n()
const titleId = useId()
</script>

<template>
  <section
    :aria-labelledby="titleId"
    class="flex flex-col gap-4"
    data-testid="pz-empty-state"
  >
    <div class="relative flex flex-col gap-3 overflow-hidden rounded-(--pz-radius-lg) border border-default bg-muted p-5">
      <PzRidge class="-mx-5 -mt-5 mb-1 h-16 w-[calc(100%+2.5rem)] max-w-none text-(--ui-border-accented) opacity-60" />
      <h2
        :id="titleId"
        class="pz-h2 text-highlighted"
      >
        {{ title ?? t('pz.kit.empty.title', { place: placeName ?? '' }) }}
      </h2>
      <p class="pz-body text-muted">
        {{ description ?? t('pz.kit.empty.ask') }}
      </p>
      <ul
        v-if="contributeTypes?.length"
        class="grid grid-cols-1 gap-2 sm:grid-cols-3"
        data-testid="pz-empty-actions"
      >
        <li
          v-for="item in contributeTypes"
          :key="item.to"
          class="flex"
        >
          <NuxtLink
            :to="item.to"
            class="pz-label flex min-h-(--pz-tap-min) flex-1 flex-col items-center justify-center gap-1.5 rounded-(--pz-radius-md) border border-accented bg-default p-2 text-center text-default no-underline hover:bg-elevated sm:min-h-19"
          >
            <UIcon
              v-if="item.icon"
              :name="item.icon"
              class="size-5 text-primary"
              aria-hidden="true"
            />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </li>
      </ul>
    </div>

    <div
      v-if="municipality || nearby?.length || $slots.known"
      class="flex flex-col gap-2"
      data-testid="pz-empty-known"
    >
      <h3 class="pz-overline text-muted">
        {{ t('pz.kit.empty.known') }}
      </h3>
      <dl
        v-if="municipality || nearby?.length"
        class="pz-body grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1"
      >
        <template v-if="municipality">
          <dt class="text-muted">
            {{ t('pz.kit.empty.municipality') }}
          </dt>
          <dd class="m-0 font-medium wrap-anywhere">
            {{ municipality }}
          </dd>
        </template>
        <template v-if="nearby?.length">
          <dt class="text-muted">
            {{ t('pz.kit.empty.nearby') }}
          </dt>
          <dd class="m-0 font-medium">
            <ul class="flex flex-wrap gap-x-3 gap-y-1">
              <li
                v-for="place in nearby"
                :key="place.to"
              >
                <NuxtLink
                  :to="place.to"
                  class="text-primary underline underline-offset-2"
                >
                  {{ place.label }}
                </NuxtLink>
              </li>
            </ul>
          </dd>
        </template>
      </dl>
      <slot name="known" />
    </div>
  </section>
</template>
