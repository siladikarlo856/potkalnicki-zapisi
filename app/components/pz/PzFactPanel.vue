<script setup lang="ts">
// The side panel on heritage, word and settlement pages: facts, trust, sources, actions and the way into a
// game. 340px and sticky at 88px on desktop; on a phone the same sections fold into the page; in print it
// prints inline, as text. Content comes in slots, so the trust slot takes whatever badges the page uses.
export interface PzFact {
  label: string
  value?: string | null
  to?: string
}
export interface PzFactSource {
  label: string
  href?: string
}

defineProps<{
  facts?: PzFact[]
  sources?: PzFactSource[]
  /** The wheat play card: starts a round seeded with this entry. */
  play?: { title?: string, to: string, description?: string }
}>()

const { t } = useI18n()
const factsId = useId()
const trustId = useId()
const sourcesId = useId()
</script>

<template>
  <aside
    class="flex flex-col gap-5 rounded-(--pz-radius-lg) border border-default bg-muted p-5 lg:sticky lg:top-22 lg:w-(--pz-side-panel) print:static print:w-auto print:border-0 print:p-0"
    data-testid="pz-fact-panel"
  >
    <section
      v-if="facts?.length || $slots.facts"
      :aria-labelledby="factsId"
    >
      <h2
        :id="factsId"
        class="pz-overline mb-2 text-muted"
      >
        {{ t('pz.kit.factPanel.facts') }}
      </h2>
      <slot name="facts">
        <dl class="pz-label grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 font-normal">
          <template
            v-for="fact in facts"
            :key="fact.label"
          >
            <dt class="text-muted">
              {{ fact.label }}
            </dt>
            <dd
              class="m-0 font-medium wrap-anywhere"
              :class="{ 'font-normal text-dimmed': !fact.value }"
            >
              <NuxtLink
                v-if="fact.value && fact.to"
                :to="fact.to"
                class="text-primary underline underline-offset-2"
              >
                {{ fact.value }}
              </NuxtLink>
              <template v-else>
                {{ fact.value || t('pz.kit.factPanel.unknown') }}
              </template>
            </dd>
          </template>
        </dl>
      </slot>
    </section>

    <section
      v-if="$slots.trust"
      :aria-labelledby="trustId"
      data-testid="pz-fact-panel-trust"
    >
      <h2
        :id="trustId"
        class="pz-overline mb-2 text-muted"
      >
        {{ t('pz.kit.factPanel.trust') }}
      </h2>
      <div class="flex flex-col gap-3">
        <slot name="trust" />
      </div>
    </section>

    <section
      v-if="sources?.length || $slots.sources"
      :aria-labelledby="sourcesId"
    >
      <h2
        :id="sourcesId"
        class="pz-overline mb-2 text-muted"
      >
        {{ t('pz.kit.factPanel.sources') }}
      </h2>
      <slot name="sources">
        <ol class="pz-body-sm m-0 flex list-decimal flex-col gap-1.5 ps-5">
          <li
            v-for="source in sources"
            :key="source.label"
            class="wrap-anywhere"
          >
            <a
              v-if="source.href"
              :href="source.href"
              rel="noopener noreferrer"
              class="text-primary underline underline-offset-2"
            >{{ source.label }}</a>
            <template v-else>
              {{ source.label }}
            </template>
          </li>
        </ol>
      </slot>
    </section>

    <div
      v-if="$slots.actions"
      class="flex flex-col gap-2 print:hidden"
      data-testid="pz-fact-panel-actions"
    >
      <slot name="actions" />
    </div>

    <NuxtLink
      v-if="play"
      :to="play.to"
      class="grid grid-cols-[2.5rem_minmax(0,1fr)_1.25rem] items-center gap-3 rounded-(--pz-radius-md) border border-accented bg-(--pz-wheat) p-3 text-default no-underline print:hidden"
      data-testid="pz-fact-panel-play"
    >
      <span class="grid size-10 place-items-center rounded-(--pz-radius-md) bg-default text-primary">
        <UIcon
          name="i-lucide-play"
          class="size-5"
          aria-hidden="true"
        />
      </span>
      <span class="min-w-0">
        <span class="pz-label block">{{ play.title ?? t('pz.kit.factPanel.play') }}</span>
        <span
          v-if="play.description"
          class="pz-caption block font-normal text-muted"
        >{{ play.description }}</span>
      </span>
      <UIcon
        name="i-lucide-chevron-right"
        class="size-5 text-muted"
        aria-hidden="true"
      />
    </NuxtLink>
  </aside>
</template>
