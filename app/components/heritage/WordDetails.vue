<script setup lang="ts">
import { REGION_FALLBACK_NAME, type AdminWord } from '~~/shared/utils/word'

defineProps<{ word: AdminWord }>()
</script>

<template>
  <div class="flex flex-col gap-4 text-sm wrap-anywhere">
    <dl class="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
      <dt class="text-muted">
        ID
      </dt><dd>{{ word.entry.id }}</dd>
      <dt class="text-muted">
        Značenje · HR
      </dt><dd class="whitespace-pre-line">
        {{ word.entry.meaning.hr || '—' }}
      </dd>
      <dt class="text-muted">
        Meaning · EN
      </dt><dd class="whitespace-pre-line">
        {{ word.entry.meaning.en || '—' }}
      </dd>
      <dt class="text-muted">
        Vrsta riječi
      </dt><dd>{{ word.entry.partOfSpeech || '—' }}</dd>
      <dt class="text-muted">
        Oznake
      </dt><dd>{{ word.entry.tags?.join(', ') || '—' }}</dd>
      <dt class="text-muted">
        Prijava
      </dt><dd>{{ word.submissionId ? `#${word.submissionId}` : '—' }}</dd>
      <dt class="text-muted">
        Prijavljeno mjesto
      </dt><dd>
        {{ word.submissionPlace || '—' }} <span
          v-if="word.submissionPlace"
          class="text-muted"
        >(privatna bilješka)</span>
      </dd>
      <dt class="text-muted">
        Stvoreno
      </dt><dd>{{ word.createdAt }}</dd>
      <dt class="text-muted">
        Izmijenjeno
      </dt><dd>{{ word.updatedAt }}</dd>
    </dl>
    <div>
      <h3 class="pz-label text-highlighted">
        Primjeri
      </h3>
      <p v-if="!word.entry.examples?.length">
        —
      </p>
      <p
        v-for="(example, index) in word.entry.examples"
        :key="index"
        class="mt-1 whitespace-pre-line"
      >
        {{ example.text }} <span class="text-muted">{{ example.translation ? ` · ${example.translation}` : '' }}{{ example.areaId ? ` · ${example.areaId}` : '' }}</span>
      </p>
    </div>
    <div>
      <h3 class="pz-label text-highlighted">
        Inačice i upotreba
      </h3>
      <div
        v-for="variant in word.entry.variants"
        :key="variant.id"
        class="mt-2 rounded-lg bg-elevated p-3"
      >
        <p><strong>{{ variant.form || '(bez oblika)' }}</strong> · {{ variant.status }}</p>
        <p class="text-muted">
          ID: {{ variant.id }} · Izgovor: {{ variant.pronunciation || '—' }} · Audio: {{ variant.audio || '—' }}
        </p>
        <p
          v-if="!variant.usages.length"
          class="text-muted"
        >
          Područje još nije odabrano; prikazuje se cijela regija ({{ REGION_FALLBACK_NAME }}).
        </p>
        <p
          v-for="usage in variant.usages"
          :key="usage.areaId"
          class="mt-1"
        >
          {{ word.areas.find(a => a.id === usage.areaId)?.name || usage.areaId }} ({{ usage.areaId }}) · {{ usage.confidence }} · Izvor: {{ usage.sourceId || '—' }} · {{ usage.note || '—' }}
        </p>
      </div>
    </div>
    <div>
      <h3 class="pz-label text-highlighted">
        Izvori i zasluge
      </h3>
      <p v-if="!word.entry.sources.length">
        —
      </p>
      <p
        v-for="source in word.entry.sources"
        :key="source.id"
      >
        {{ source.credit || 'Anonimno' }} · {{ source.kind }} · {{ source.id }}
      </p>
    </div>
    <div>
      <h3 class="pz-label text-highlighted">
        Područja · svi parametri
      </h3>
      <pre class="mt-2 max-h-64 overflow-auto rounded-lg bg-elevated p-3 text-xs whitespace-pre-wrap">{{ JSON.stringify(word.areas, null, 2) }}</pre>
    </div>
  </div>
</template>
