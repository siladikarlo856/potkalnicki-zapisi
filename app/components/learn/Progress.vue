<script setup lang="ts">
// Learn session progress: "4 od 10" over a row of segments, one per card. Right ones are teal, to-review ones brick,
// the current one has a ring. The text and the sr-only summary carry the meaning; colour only backs them up.
const props = defineProps<{
  /** 1-based position of the current card. */
  current: number
  total: number
  /** Cards answered so far, in order. */
  marks: ('known' | 'missed')[]
  /** The topics in this session, shown as a caption ("Riječi · Mjesta"). */
  topics?: string
}>()

const { t } = useI18n()
const known = computed(() => props.marks.filter(mark => mark === 'known').length)
const missed = computed(() => props.marks.length - known.value)

function segment(index: number) {
  const mark = props.marks[index]
  if (mark === 'known') return 'bg-success'
  if (mark === 'missed') return 'bg-error'
  if (index === props.marks.length) return 'bg-primary outline-2 outline-offset-0 outline-(--ui-bg) ring-[3px] ring-primary'
  return 'bg-(--ui-border)'
}
</script>

<template>
  <div
    class="flex flex-col gap-1.5"
    role="group"
    :aria-label="t('pz.learn.progressLabel')"
    data-testid="learn-progress"
  >
    <div class="flex items-baseline justify-between gap-3">
      <span
        class="pz-label text-default"
        data-testid="learn-counter"
      >
        <span aria-hidden="true">{{ t('pz.learn.counterShort', { i: current, n: total }) }}</span>
        <span class="sr-only">{{ t('pz.learn.counter', { i: current, n: total }) }}</span>
      </span>
      <span
        v-if="topics"
        class="pz-caption min-w-0 text-end text-muted"
      >{{ topics }}</span>
    </div>
    <div
      class="grid auto-cols-fr grid-flow-col gap-[3px]"
      aria-hidden="true"
    >
      <span
        v-for="index in total"
        :key="index"
        class="h-1.5 rounded-full"
        :class="segment(index - 1)"
      />
    </div>
    <span class="sr-only">{{ t('pz.learn.progressSummary', { ok: known, no: missed }) }}</span>
  </div>
</template>
