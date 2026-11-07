<script setup lang="ts">
import { pzRoutes } from '~~/shared/utils/appRoutes'

// The friend challenge hero on the home and games hub pages: the one inverted slab on its screen. Deep sage with
// the ridge in primary bleeding off the bottom right, a wheat overline, a serif title, one sentence and a full-width
// wheat button (focus rings on the slab switch to wheat in main.css). Two variants replace the copy:
//   resume:  "Nastavi izazov · runda 2 od 3"
//   waiting: "Čekamo 3 prijatelja", with a link to the leaderboard preview.
// Consumer provides title, text and target, and optionally an active challenge { code, round, rounds, players }.
// The default slot replaces the body for a consumer that needs its own (the home section lists several challenges).
const props = defineProps<{
  overline: string
  title: string
  text?: string
  cta?: string
  to?: string
  active?: { code: string, round: number, rounds: number, players: number }
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const id = useId()

const activeTo = computed(() => props.active ? localePath(`${pzRoutes.challenge}/${props.active.code}`) : '')
const boardTo = computed(() => props.active ? localePath(`${pzRoutes.challenge}/${props.active.code}/ljestvica`) : '')
const target = computed(() => activeTo.value || props.to || localePath(pzRoutes.challenge))
</script>

<template>
  <section
    class="relative flex flex-col gap-4 overflow-hidden rounded-(--pz-radius-xl) border border-inverted bg-inverted p-5 pb-24 text-inverted lg:pb-20"
    :aria-labelledby="id"
  >
    <PzRidge class="absolute -right-2.5 bottom-0 h-22 w-[70%] text-primary opacity-90" />
    <p class="pz-overline relative text-inverted">
      {{ overline }}
    </p>
    <h2
      :id="id"
      class="relative font-serif text-2xl/[30px] font-semibold text-inverted"
    >
      {{ title }}
    </h2>
    <slot>
      <p
        v-if="active"
        class="pz-body relative text-inverted"
        data-testid="pz-challenge-resume"
      >
        {{ t('pz.challenge.resume', { round: active.round, rounds: active.rounds }) }}
      </p>
      <p
        v-else-if="text"
        class="pz-body relative text-inverted"
      >
        {{ text }}
      </p>
      <p
        v-if="active && active.players > 0"
        class="pz-body-sm relative text-inverted"
      >
        {{ t('pz.challenge.waiting', { n: active.players }) }}
        <NuxtLink
          :to="boardTo"
          class="font-semibold underline"
        >
          {{ t('pz.challenge.boardPreview') }}
        </NuxtLink>
      </p>
      <UButton
        :to="target"
        :label="active ? t('challenge.resumeContinue') : cta"
        :icon="active ? undefined : 'i-lucide-flag'"
        :trailing-icon="active ? 'i-lucide-arrow-right' : undefined"
        size="lg"
        color="neutral"
        block
        class="relative bg-(--pz-wheat) text-default hover:bg-(--pz-wheat) hover:brightness-95"
        data-testid="pz-challenge-cta"
      />
    </slot>
  </section>
</template>
