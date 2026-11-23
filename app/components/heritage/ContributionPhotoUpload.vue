<script setup lang="ts">
import { SUBMISSION_PHOTO_LIMITS } from '~~/shared/utils/submissionPhoto'

export interface LocalPhoto {
  id: string
  file: File
  previewUrl: string
  alt: string
  author: string
  publishPermission: '' | 'own' | 'family'
  error?: string
}

const photos = defineModel<LocalPhoto[]>('photos', { required: true })
const uploading = defineModel<boolean>('uploading', { default: false })
const selectionError = defineModel<string>('selectionError', { default: '' })

const input = useTemplateRef<HTMLInputElement>('input')
const over = ref(false)

const free = computed(() => SUBMISSION_PHOTO_LIMITS.perSubmission - photos.value.length)
const accept = 'image/jpeg,image/png,.jpg,.jpeg,.png'

function reject(message: string) {
  return message
}

function checkFile(file: File): string | null {
  if (file.size > SUBMISSION_PHOTO_LIMITS.maxBytes) return reject('Datoteka je prevelika. Najviše 10 MB, u obliku JPG ili PNG.')
  const type = file.type.toLowerCase()
  if (type !== 'image/jpeg' && type !== 'image/png') return reject('Datoteka je prevelika. Najviše 10 MB, u obliku JPG ili PNG.')
  return null
}

function addFiles(list: FileList | File[]) {
  if (uploading.value) return
  const incoming = [...list]
  if (!incoming.length) return
  const room = Math.max(0, free.value)
  if (incoming.length > room) {
    selectionError.value = `Preostalo mjesta za fotografije: ${room}. Odaberi manje datoteka ili najprije ukloni odabrane fotografije.`
    return
  }
  selectionError.value = ''
  for (const file of incoming) {
    const error = checkFile(file)
    photos.value.push({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      alt: '',
      author: '',
      publishPermission: '',
      error: error ?? undefined
    })
  }
}

function onPick(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) addFiles(target.files)
  target.value = ''
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  over.value = false
  if (event.dataTransfer?.files) addFiles(event.dataTransfer.files)
}

function removePhoto(id: string) {
  if (uploading.value) return
  const index = photos.value.findIndex(photo => photo.id === id)
  if (index < 0) return
  URL.revokeObjectURL(photos.value[index]!.previewUrl)
  photos.value.splice(index, 1)
  selectionError.value = ''
}

onBeforeUnmount(() => {
  for (const photo of photos.value) URL.revokeObjectURL(photo.previewUrl)
})
</script>

<template>
  <!-- eslint-disable better-tailwindcss/no-unknown-classes -- design-system Upload -->
  <div class="flex flex-col gap-4">
    <p
      v-if="selectionError"
      class="text-sm text-error"
      role="alert"
    >
      {{ selectionError }}
    </p>
    <div
      v-if="free > 0"
      class="pz-dropzone flex flex-col items-center gap-2 rounded-(--pz-radius-lg) border border-dashed p-6 text-center"
      :class="over ? 'is-over border-default bg-muted' : 'border-accented bg-muted/40'"
      data-testid="photo-dropzone"
      @dragover.prevent="over = true"
      @dragleave.prevent="over = false"
      @drop="onDrop"
    >
      <UIcon
        name="i-lucide-image-plus"
        class="size-8 text-primary"
        aria-hidden="true"
      />
      <p class="pz-body-sm text-default">
        Povuci fotografije ovdje ili odaberi datoteke.
      </p>
      <p class="text-xs text-muted">
        JPG ili PNG, do 10 MB po fotografiji.
      </p>
      <UButton
        label="Odaberi fotografije"
        color="neutral"
        variant="outline"
        :disabled="uploading"
        @click="input?.click()"
      />
      <input
        ref="input"
        type="file"
        class="sr-only"
        :accept="accept"
        multiple
        :disabled="uploading"
        @change="onPick"
      >
    </div>

    <ul
      v-if="photos.length"
      class="flex flex-col gap-3"
      data-testid="photo-upload-list"
    >
      <li
        v-for="(photo, index) in photos"
        :key="photo.id"
        class="pz-upload grid gap-3 rounded-(--pz-radius-lg) border border-default bg-default p-3 sm:grid-cols-[96px_minmax(0,1fr)]"
      >
        <img
          :src="photo.previewUrl"
          :alt="photo.alt || `Pregled fotografije ${index + 1}`"
          class="size-24 rounded-(--pz-radius-md) object-cover"
          width="96"
          height="96"
        >
        <div class="pz-upload__body flex min-w-0 flex-col gap-3">
          <div class="flex items-start justify-between gap-2">
            <p class="truncate text-sm font-medium text-highlighted">
              {{ photo.file.name }}
            </p>
            <UButton
              :aria-label="`Ukloni fotografiju ${photo.file.name}`"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              :disabled="uploading"
              @click="removePhoto(photo.id)"
            />
          </div>
          <p
            v-if="photo.error"
            class="text-sm text-error"
            role="alert"
          >
            {{ photo.error }}
          </p>
          <template v-else>
            <UFormField
              :name="`photo-${index}-alt`"
              label="Što je na fotografiji?"
              required
            >
              <UInput
                v-model="photo.alt"
                :disabled="uploading"
                :maxlength="SUBMISSION_PHOTO_LIMITS.alt.max"
                class="w-full"
              />
            </UFormField>
            <UFormField
              :name="`photo-${index}-author`"
              label="Autor fotografije"
              required
            >
              <UInput
                v-model="photo.author"
                :disabled="uploading"
                :maxlength="SUBMISSION_PHOTO_LIMITS.author.max"
                placeholder="nepoznat"
                class="w-full"
              />
            </UFormField>
            <UFormField
              :name="`photo-${index}-permission`"
              label="Smijemo li je objaviti?"
              required
            >
              <URadioGroup
                v-model="photo.publishPermission"
                :disabled="uploading"
                :items="[
                  { label: 'Fotografija je moja i dopuštam objavu', value: 'own' },
                  { label: 'Imam dopuštenje autora ili obitelji', value: 'family' }
                ]"
              />
            </UFormField>
          </template>
        </div>
      </li>
    </ul>
  </div>
</template>
