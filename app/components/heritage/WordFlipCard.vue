<script setup lang="ts">
import type { WordEntry } from '~/types/heritage'

const props = defineProps<{
  entry: WordEntry
  /** Smaller card without the variant list, used as the homepage preview. */
  compact?: boolean
  /** Also gives the meaning and the example in English, for /en visitors. */
  english?: boolean
}>()

const flipped = defineModel<boolean>('flipped', { default: false })
const { t } = useI18n()
const emit = defineEmits<{ contribute: [] }>()

const sample = computed(() => props.entry.status === 'placeholder')
const headVariant = computed(() => props.entry.variants[0])
const otherForms = computed(() => props.entry.variants.slice(1).map(variant => variant.form).join(' · '))
const example = computed(() => props.entry.examples?.[0])
const gloss = computed(() => props.english ? props.entry.meaning.en : undefined)

// Like the flip hint, the back-face labels are card chrome, not the word, so /en visitors read them in English.
const labelLang = computed(() => props.english ? 'en' : undefined)
const labels = computed(() => props.english
  ? { meaning: 'Meaning', example: 'Example: ', alsoHeard: 'Also heard: ', variants: 'Variants by place' }
  : { meaning: 'Značenje', example: 'Primjer: ', alsoHeard: 'Čuje se i: ', variants: 'Inačice po mjestima' })
</script>

<template>
  <div
    class="cursor-pointer perspective-distant"
    :class="compact ? 'h-64' : 'h-[clamp(15rem,46svh,24rem)] lg:h-[clamp(17rem,52svh,26rem)]'"
    lang="hr"
    @click="flipped = !flipped"
  >
    <!-- The faces swap visually, so screen readers hear the meaning through this live region. -->
    <p
      class="sr-only"
      aria-live="polite"
    >
      <template v-if="flipped">
        {{ entry.headword }}: {{ entry.meaning.hr }}<span
          v-if="gloss"
          lang="en"
        > ({{ gloss }})</span>
      </template>
    </p>
    <!-- Print flattens 3D, so backface-hidden stops working and the turned-away face printed
         mirrored on top. Print shows only the face that is up, unrotated.
         Both faces scroll: with wider text spacing the compact front's hint no longer fits in h-64. -->
    <div
      class="relative size-full transition-transform duration-500 transform-3d motion-reduce:transition-none print:transform-none"
      :class="{ 'rotate-y-180': flipped }"
    >
      <div
        class="absolute inset-0 flex flex-col overflow-y-auto rounded-xl bg-default p-4 shadow-sm ring ring-default backface-hidden sm:p-5 print:aria-hidden:hidden"
        :aria-hidden="flipped"
        :inert="flipped"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-semibold tracking-wide text-primary uppercase">Kaj to znači?</span>
          <HeritageSampleBadge
            v-if="sample"
            :english="english"
          />
        </div>
        <div class="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p
            class="font-bold tracking-tight text-highlighted"
            :class="compact ? 'text-4xl' : 'text-4xl sm:text-5xl'"
          >
            {{ entry.headword }}
          </p>
          <!-- On the narrow homepage card the line wraps; each language stays whole, so the English moves below. -->
          <p
            v-if="entry.partOfSpeech"
            class="text-sm text-muted"
          >
            <span class="whitespace-nowrap">{{ entry.partOfSpeech }}</span>
          </p>
          <div
            v-if="!compact && headVariant"
            class="mt-1 flex flex-wrap justify-center gap-1"
          >
            <HeritageAreaTag
              v-if="!headVariant.usages.length"
              :sample="sample"
              :english="english"
            />
            <HeritageAreaTag
              v-for="usage in headVariant.usages"
              :key="usage.areaId"
              :usage="usage"
              :sample="sample"
              :english="english"
            />
          </div>
        </div>
        <!-- Mouse users click and touch users tap, so the hint follows the primary pointer.
             The hint is an instruction, not part of the word, so /en visitors get it in English.
             It wraps on the 240px homepage card, so the icon sits inline and the two lines are balanced and centred. -->
        <p
          class="text-center text-xs text-balance text-muted pointer-fine:hidden"
          :lang="english ? 'en' : undefined"
        >
          <UIcon
            name="i-lucide-pointer"
            class="mr-1 inline-block size-3.5 align-[-0.2em]"
          />{{ english ? 'Tap the card to see the meaning' : 'Dodirni karticu da vidiš značenje' }}
        </p>
        <p
          class="hidden text-center text-xs text-balance text-muted pointer-fine:block"
          :lang="english ? 'en' : undefined"
        >
          <UIcon
            name="i-lucide-mouse-pointer-click"
            class="mr-1 inline-block size-3.5 align-[-0.2em]"
          />{{ english ? 'Click the card to see the meaning' : 'Klikni na karticu da vidiš značenje' }}
        </p>
      </div>

      <div
        class="absolute inset-0 flex rotate-y-180 flex-col gap-2 overflow-y-auto rounded-xl bg-default p-4 shadow-sm ring-2 ring-primary/40 backface-hidden sm:p-5 print:transform-none print:aria-hidden:hidden"
        :aria-hidden="!flipped"
        :inert="!flipped"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm text-muted">
            <span class="font-semibold text-default">{{ entry.headword }}</span>
            <!-- Croatian only: the front already gave the English, and the badge shares this line. -->
            <template v-if="entry.partOfSpeech">
              · {{ entry.partOfSpeech }}
            </template>
          </p>
          <HeritageSampleBadge
            v-if="sample"
            :english="english"
          />
        </div>
        <div>
          <p
            class="text-xs text-muted"
            :lang="labelLang"
          >
            {{ labels.meaning }}
          </p>
          <p class="text-3xl font-bold text-highlighted">
            {{ entry.meaning.hr }}
          </p>
          <p
            v-if="gloss"
            class="text-sm text-muted"
            lang="en"
          >
            ({{ gloss }})
          </p>
        </div>
        <p
          v-if="example"
          class="text-sm"
        >
          <!-- The space stays inside the label: Vue drops whitespace between tags on separate lines. -->
          <span
            class="text-muted"
            :lang="labelLang"
          >{{ labels.example }}</span>
          <i class="text-default">{{ example.text }}</i>
          <span
            v-if="example.translation"
            class="text-muted"
          >&nbsp;— {{ example.translation }}</span>
        </p>
        <p
          v-if="compact && otherForms"
          class="text-sm text-muted"
        >
          <span :lang="labelLang">{{ labels.alsoHeard }}</span><span class="font-semibold text-default">{{ otherForms }}</span>
        </p>
        <div
          v-if="!compact"
          class="border-t border-default pt-3"
        >
          <p
            class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted"
            :lang="labelLang"
          >
            <UIcon
              name="i-lucide-git-fork"
              class="size-3.5 shrink-0"
            />
            {{ labels.variants }}
          </p>
          <HeritageVariantList
            :entry="entry"
            :english="english"
          />
          <!-- The card is a click-to-flip surface, so this control must not flip it again. -->
          <UButton
            :label="t('game.differently')"
            icon="i-lucide-message-square-plus"
            color="neutral"
            variant="link"
            size="sm"
            class="mt-2 -ms-2 px-2"
            :lang="labelLang"
            @click.stop="emit('contribute')"
          />
        </div>
      </div>
    </div>
  </div>
</template>
