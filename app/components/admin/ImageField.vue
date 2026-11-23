<script setup lang="ts">
import {
  HERITAGE_IMAGE_LIMITS, IMAGE_LICENSES, IMAGE_LICENSE_LABELS, heritageImageUrl,
  type HeritageImageValue, type ImageLicense
} from '#shared/utils/content/heritageImage'

const $fetch = useEditorialFetch()

// ImageField of the design system, for the photos of a heritage item: upload (resized in the browser first), the credit
// each photo needs, and the order (the first one, *Naslovna*, is the main photo on cards and the item page). Uploaded files
// only become public on the site once the item is saved with them.
const props = defineProps<{ images: HeritageImageValue[] }>()
const emit = defineEmits<{ 'update:images': [HeritageImageValue[]] }>()

interface UploadResult {
  path: string
  thumbPath: string
  width: number
  height: number
}

const { data: storage } = useFetch<{ base: string }>('/api/admin/images', { $fetch, server: false })
const input = ref<HTMLInputElement | null>(null)
const uploading = ref(0)
const failure = ref('')

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const SOURCE_EXAMPLE = 'https://commons.wikimedia.org/wiki/File:...'
const licenseOptions = IMAGE_LICENSES.map(value => ({ label: IMAGE_LICENSE_LABELS[value], value }))
const free = computed(() => HERITAGE_IMAGE_LIMITS.perItem - props.images.length - uploading.value)

function thumbUrl(image: HeritageImageValue) {
  return storage.value?.base ? heritageImageUrl(storage.value.base, image.thumbPath) : ''
}

function update(index: number, partial: Partial<HeritageImageValue>) {
  emit('update:images', props.images.map((image, position) => position === index ? { ...image, ...partial } : image))
}

function text(index: number, key: 'alt' | 'author', value: unknown) {
  update(index, { [key]: String(value ?? '') })
}

function optional(index: number, key: 'caption' | 'authorUrl' | 'sourceUrl', value: unknown) {
  update(index, { [key]: String(value ?? '').trim() ? String(value) : null })
}

function move(index: number, by: -1 | 1) {
  const target = index + by
  if (target < 0 || target >= props.images.length) return
  const next = [...props.images]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  emit('update:images', next)
}

function remove(index: number) {
  emit('update:images', props.images.filter((_, position) => position !== index))
}

async function upload(file: File): Promise<HeritageImageValue> {
  const { large, thumb } = await resizeImage(file)
  let stored: UploadResult
  try {
    stored = await $fetch<UploadResult>('/api/admin/images', {
      method: 'POST',
      body: { image: large.base64, thumb: thumb.base64 }
    })
  } catch (error) {
    const problem = adminApiError(error)
    throw new Error(problem.issues?.map(issue => issue.message).join(' ') || problem.message, { cause: error })
  }
  return {
    ...stored,
    alt: '',
    caption: null,
    author: '',
    authorUrl: null,
    sourceUrl: null,
    // Chosen by the editor for every photo; the form refuses to save without it.
    license: '' as ImageLicense
  }
}

async function onFiles(event: Event) {
  const target = event.target as HTMLInputElement
  const files = [...(target.files ?? [])].slice(0, Math.max(0, free.value))
  target.value = ''
  failure.value = ''
  for (const file of files) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      failure.value = `${file.name}: Ovaj oblik datoteke nije podržan. Prenesi JPG, PNG ili WebP.`
      continue
    }
    uploading.value += 1
    try {
      const image = await upload(file)
      emit('update:images', [...props.images, image])
    } catch (error) {
      failure.value = `${file.name}: ${error instanceof Error ? error.message : 'Učitavanje nije uspjelo.'}`
    } finally {
      uploading.value -= 1
    }
  }
}
</script>

<template>
  <fieldset
    class="flex flex-col gap-3"
    data-test="admin-heritage-images"
  >
    <legend class="mb-1 text-sm font-medium text-highlighted">
      Fotografije
    </legend>
    <p class="text-sm text-muted">
      Prva je glavna fotografija. Uz svaku upiši autora, licenciju i izvor (npr. stranicu datoteke na Wikimedia
      Commonsu); bez toga se ne smije objaviti. Fotografija postaje javna tek kad spremiš zapis.
    </p>

    <div
      v-for="(image, index) in images"
      :key="image.path"
      class="flex flex-col gap-3 rounded-md border border-default p-3 sm:flex-row"
    >
      <div class="flex shrink-0 flex-col items-start gap-2">
        <span
          v-if="index === 0"
          class="rounded-full border border-default px-2 text-xs font-bold"
          data-testid="admin-image-cover"
        >Naslovna</span>
        <img
          v-if="thumbUrl(image)"
          :src="thumbUrl(image)"
          :alt="image.alt || 'Pregled fotografije'"
          :width="160"
          :height="Math.round(160 * image.height / image.width)"
          class="w-40 rounded bg-elevated object-cover"
        >
        <p class="text-xs text-muted">
          {{ image.width }} × {{ image.height }}
        </p>
        <div class="flex gap-1">
          <UButton
            icon="i-lucide-arrow-up"
            color="neutral"
            variant="ghost"
            size="xs"
            type="button"
            :disabled="index === 0"
            :aria-label="`Pomakni fotografiju ${index + 1} gore`"
            @click="move(index, -1)"
          />
          <UButton
            icon="i-lucide-arrow-down"
            color="neutral"
            variant="ghost"
            size="xs"
            type="button"
            :disabled="index === images.length - 1"
            :aria-label="`Pomakni fotografiju ${index + 1} dolje`"
            @click="move(index, 1)"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            size="xs"
            type="button"
            :aria-label="`Ukloni fotografiju ${index + 1}`"
            @click="remove(index)"
          />
        </div>
      </div>

      <div class="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
        <AdminFormField
          :name="`images.${index}.alt`"
          label="Opis slike za čitače zaslona"
          required
          class="sm:col-span-2"
        >
          <UInput
            :model-value="image.alt"
            :maxlength="HERITAGE_IMAGE_LIMITS.alt"
            placeholder="Što se vidi na fotografiji"
            class="w-full"
            @update:model-value="value => text(index, 'alt', value)"
          />
        </AdminFormField>
        <AdminFormField
          :name="`images.${index}.caption`"
          label="Potpis"
          optional
          class="sm:col-span-2"
        >
          <UInput
            :model-value="image.caption ?? ''"
            :maxlength="HERITAGE_IMAGE_LIMITS.caption"
            class="w-full"
            @update:model-value="value => optional(index, 'caption', value)"
          />
        </AdminFormField>
        <AdminFormField
          :name="`images.${index}.author`"
          label="Autor"
          required
        >
          <UInput
            :model-value="image.author"
            :maxlength="HERITAGE_IMAGE_LIMITS.author"
            class="w-full"
            @update:model-value="value => text(index, 'author', value)"
          />
        </AdminFormField>
        <AdminFormField
          :name="`images.${index}.license`"
          label="Licencija"
          required
        >
          <USelect
            :model-value="image.license || undefined"
            :items="licenseOptions"
            placeholder="Odaberi licenciju"
            class="w-full"
            @update:model-value="value => update(index, { license: value as ImageLicense })"
          />
        </AdminFormField>
        <AdminFormField
          :name="`images.${index}.sourceUrl`"
          label="Izvor ili poveznica"
          :required="image.license !== 'permission'"
        >
          <UInput
            :model-value="image.sourceUrl ?? ''"
            :maxlength="HERITAGE_IMAGE_LIMITS.url"
            type="url"
            :placeholder="SOURCE_EXAMPLE"
            class="w-full"
            @update:model-value="value => optional(index, 'sourceUrl', value)"
          />
        </AdminFormField>
        <AdminFormField
          :name="`images.${index}.authorUrl`"
          label="Poveznica na autora"
          optional
        >
          <UInput
            :model-value="image.authorUrl ?? ''"
            :maxlength="HERITAGE_IMAGE_LIMITS.url"
            type="url"
            class="w-full"
            @update:model-value="value => optional(index, 'authorUrl', value)"
          />
        </AdminFormField>
      </div>
    </div>

    <AdminFormField name="images">
      <div class="flex flex-wrap items-center gap-3">
        <UButton
          :label="uploading ? 'Učitavanje…' : 'Prenesi fotografiju'"
          icon="i-lucide-image-plus"
          color="neutral"
          variant="outline"
          size="sm"
          type="button"
          :loading="uploading > 0"
          :disabled="free <= 0"
          data-test="admin-add-image"
          @click="input?.click()"
        />
        <span class="text-xs text-muted">
          JPEG, PNG ili WebP, najviše {{ HERITAGE_IMAGE_LIMITS.perItem }} po zapisu; smanjuju se prije slanja.
        </span>
        <input
          ref="input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          class="hidden"
          @change="onFiles"
        >
      </div>
    </AdminFormField>
    <p
      v-if="failure"
      class="text-sm text-error"
      role="alert"
    >
      {{ failure }}
    </p>
  </fieldset>
</template>
