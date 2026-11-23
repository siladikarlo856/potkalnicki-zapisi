<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import type { LocalPhoto } from './ContributionPhotoUpload.vue'

const { t, locale } = useI18n()
const { user, session, configured, signIn } = useAuthSession()
const route = useRoute()
const formId = useId()
const form = useTemplateRef('form')
const summary = useTemplateRef<HTMLElement>('summary')

const state = reactive({
  placeId: null as string | null,
  name: '',
  contact: '',
  consentPublish: false,
  website: ''
})
const placeQuery = ref('')
const photos = ref<LocalPhoto[]>([])
const uploading = ref(false)
const sendState = ref<'idle' | 'sent' | 'error'>('idle')
const sendError = ref('')
const validationErrors = ref<FormError[]>([])
const photoSelectionError = ref('')
const hasInvalidPhotos = computed(() => !!photoSelectionError.value || photos.value.some(photo => !!photo.error))

function validate(): FormError[] {
  const errors: FormError[] = []
  if (photoSelectionError.value) errors.push({ name: 'photos', message: photoSelectionError.value })
  if (!photos.value.length) errors.push({ name: 'photos', message: 'Dodaj barem jednu fotografiju.' })
  for (const [index, photo] of photos.value.entries()) {
    if (photo.error) {
      errors.push({ name: 'photos', message: photo.error })
      continue
    }
    if (!photo.alt.trim()) errors.push({ name: `photo-${index}-alt`, message: 'Opiši što je na fotografiji.' })
    if (!photo.author.trim()) errors.push({ name: `photo-${index}-author`, message: 'Upiši tko je snimio fotografiju.' })
    if (!photo.publishPermission) errors.push({ name: `photo-${index}-permission`, message: 'Označi smijemo li objaviti fotografiju.' })
  }
  if (!state.consentPublish) errors.push({ name: 'consentPublish', message: t('heritage.form.errors.consent') })
  validationErrors.value = errors
  if (errors.length) nextTick(() => summary.value?.focus())
  return errors
}

async function send() {
  if (uploading.value || hasInvalidPhotos.value) return
  const accessToken = session.value?.access_token
  if (!accessToken) {
    sendError.value = 'Prijavi se Google računom da pošalješ fotografije.'
    sendState.value = 'error'
    return
  }
  const body = new FormData()
  body.append('meta', JSON.stringify({
    locale: locale.value,
    name: state.name.trim() || null,
    contact: state.contact.trim() || null,
    consentPublish: true,
    placeId: state.placeId,
    photos: photos.value.map(photo => ({
      alt: photo.alt.trim(),
      author: photo.author.trim(),
      publishPermission: true
    }))
  }))
  photos.value.forEach((photo, index) => body.append(`photo-${index}`, photo.file, photo.file.name))
  uploading.value = true
  sendState.value = 'idle'
  try {
    await $fetch('/api/submissions/photo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body
    })
    photos.value.forEach(photo => URL.revokeObjectURL(photo.previewUrl))
    photos.value = []
    Object.assign(state, { placeId: null, name: '', contact: '', consentPublish: false })
    placeQuery.value = ''
    validationErrors.value = []
    sendState.value = 'sent'
  } catch (error) {
    const { statusCode, data } = error as { statusCode?: number, data?: { data?: { issues?: Array<{ path?: string, message?: string }> } } }
    const issues = data?.data?.issues
    if (statusCode === 400 && issues?.length) {
      validationErrors.value = issues.map((issue) => {
        const match = issue.path?.match(/^photos\[(\d+)\]\.(alt|author|publishPermission)$/)
        const name = match
          ? `photo-${match[1]}-${match[2] === 'publishPermission' ? 'permission' : match[2]}`
          : issue.path === 'placeId' ? 'place' : issue.path?.startsWith('photo-') ? 'photos' : issue.path ?? 'photos'
        return { name, message: issue.message ?? t('heritage.form.errors.invalid') }
      })
      form.value?.setErrors(validationErrors.value)
    }
    sendError.value = statusCode === 401
      ? 'Prijavi se Google računom da pošalješ fotografije.'
      : statusCode === 429
        ? t('heritage.form.errorTooMany')
        : t('heritage.form.errorGeneric')
    sendState.value = 'error'
    nextTick(() => summary.value?.focus())
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div
    class="flex flex-col gap-4"
    data-testid="photo-submission-form"
  >
    <UAlert
      v-if="configured && !user"
      color="warning"
      variant="subtle"
      icon="i-lucide-log-in"
      title="Prijavi se da pošalješ fotografiju"
      description="Fotografije mogu poslati samo prijavljeni suradnici. Tekstualne priloge i dalje možeš slati bez računa."
      :actions="[{ label: 'Prijavi se', onClick: () => signIn(route.fullPath) }]"
      data-testid="photo-sign-in-required"
    />

    <PzSubmissionSuccess
      v-if="sendState === 'sent'"
      @again="sendState = 'idle'"
    />

    <template v-else-if="user">
      <UForm
        :id="formId"
        ref="form"
        :state="state"
        :validate="validate"
        novalidate
        class="flex flex-col gap-4 rounded-lg bg-default p-4 ring ring-default sm:p-6"
        @submit="send"
      >
        <div
          v-if="validationErrors.length"
          ref="summary"
          tabindex="-1"
          class="rounded-(--pz-radius-md) border border-(--pz-error) bg-(--pz-error-bg) p-3 outline-none"
          role="alert"
        >
          <p class="font-bold">
            Prilog još nije poslan. Treba dopuniti {{ validationErrors.length }} {{ validationErrors.length === 1 ? 'polje' : 'polja' }}.
          </p>
        </div>
        <UAlert
          v-if="sendState === 'error'"
          color="error"
          variant="subtle"
          :title="sendError"
          icon="i-lucide-circle-alert"
          role="alert"
        />

        <fieldset
          :disabled="uploading"
          :inert="uploading"
          class="contents"
        >
          <UFormField name="photos">
            <HeritageContributionPhotoUpload
              v-model:photos="photos"
              v-model:uploading="uploading"
              v-model:selection-error="photoSelectionError"
            />
          </UFormField>

          <UFormField
            name="place"
            :label="t('heritage.form.place')"
            :help="t('heritage.places.help')"
            class="sm:col-span-2"
          >
            <HeritagePlacePicker
              v-model="state.placeId"
              v-model:query="placeQuery"
              @selection="form?.clear('place')"
            />
          </UFormField>

          <HeritageSubmissionContributorFields
            v-model:name="state.name"
            v-model:contact="state.contact"
            v-model:consent-publish="state.consentPublish"
            v-model:website="state.website"
            privacy-in-new-tab
          />
        </fieldset>

        <UButton
          type="submit"
          :label="uploading ? 'Šaljem…' : t('heritage.form.submit')"
          :loading="uploading"
          :disabled="uploading || hasInvalidPhotos"
          size="lg"
          class="self-start"
        />
      </UForm>
    </template>
  </div>
</template>
