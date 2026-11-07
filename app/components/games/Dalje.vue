<script setup lang="ts">
// The explicit "Dalje" after feedback, and the only way a round moves on. In the sticky action bar on mobile, directly
// under the feedback on desktop (the bar is `lg:hidden`, the inline button `hidden lg:flex`). On the last question
// it reads "Pogledaj rezultat".
const props = withDefaults(defineProps<{ last?: boolean, testid?: string }>(), { testid: 'game-next' })
const emit = defineEmits<{ next: [] }>()
const { t } = useI18n()
</script>

<template>
  <UButton
    :label="t(last ? 'pz.play.seeResult' : 'pz.play.next')"
    trailing-icon="i-lucide-arrow-right"
    size="xl"
    block
    class="hidden lg:flex print:hidden"
    :data-testid="`${props.testid}-desktop`"
    @click="emit('next')"
  />
  <PzStickyActionBar class="-mx-4 sm:-mx-6">
    <UButton
      :label="t(last ? 'pz.play.seeResult' : 'pz.play.next')"
      trailing-icon="i-lucide-arrow-right"
      size="xl"
      block
      :data-testid="props.testid"
      @click="emit('next')"
    />
  </PzStickyActionBar>
</template>
