<script setup lang="ts">
import { CHALLENGE_LIST_STORAGE_KEY } from '~~/shared/utils/challengeList'
import { LEARN_STORAGE_KEY } from '~~/shared/utils/learn/learnState'
import { GAME_SCORES_KEY } from '~~/shared/utils/games/scores'
import { DAILY_STORAGE_KEY } from '~~/app/composables/useDailyProgress'
import { LEGACY_PROGRESS_STORAGE_KEY, PROGRESS_STORAGE_KEY } from '~~/app/composables/useProgress'
import { PZ_HOME_STORAGE_KEY } from '~~/app/composables/usePzHome'
import { CONTRIBUTION_DRAFT_STORAGE_KEY } from '~~/app/utils/contributionDraft'

definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const localePath = useLocalePath()
const { site } = useAppConfig()
const open = ref(false)
const deleted = ref(false)

const contents = [
  ['uredaj', 'Što ostaje na tvom uređaju'],
  ['posluzitelj', 'Što šalješ nama'],
  ['nema', 'Čega nema'],
  ['brisanje', 'Kako obrisati podatke'],
  ['kontakt', 'Kontakt']
] as const

function forgetDeviceData() {
  if (!import.meta.client) return
  const keys = [
    CHALLENGE_LIST_STORAGE_KEY,
    LEARN_STORAGE_KEY,
    GAME_SCORES_KEY,
    DAILY_STORAGE_KEY,
    PROGRESS_STORAGE_KEY,
    LEGACY_PROGRESS_STORAGE_KEY,
    PZ_HOME_STORAGE_KEY,
    'pz-search/v1'
  ]
  for (const key of keys) window.localStorage.removeItem(key)
  for (let index = window.localStorage.length - 1; index >= 0; index--) {
    const key = window.localStorage.key(index)
    if (key?.startsWith(`${CONTRIBUTION_DRAFT_STORAGE_KEY}/`)) window.localStorage.removeItem(key)
  }
  open.value = false
  deleted.value = true
}

useSeoMeta({
  title: () => 'Privatnost',
  ogTitle: () => 'Privatnost · Potkalnički zapisi',
  description: () => 'Javne stranice možeš koristiti bez računa. Ako se prijaviš, ne prikazujemo oglase i ne pratimo te po internetu.',
  ogDescription: () => 'Javne stranice možeš koristiti bez računa. Ako se prijaviš, ne prikazujemo oglase i ne pratimo te po internetu.'
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-8 px-4 py-6 lg:px-12 lg:py-12">
    <PageHead
      title="Privatnost"
      lead="Javne stranice možeš koristiti bez računa. Ako se prijaviš, ne prikazujemo oglase i ne pratimo te po internetu."
      meta="Ova je stranica nacrt. Pravne pojedinosti još treba potvrditi."
    />

    <div class="grid gap-8 lg:grid-cols-[240px_minmax(0,66ch)] lg:items-start lg:justify-center lg:gap-12">
      <nav
        class="rounded-(--pz-radius-lg) border border-default bg-default p-4 lg:sticky lg:top-20"
        aria-labelledby="privacy-contents"
      >
        <h2
          id="privacy-contents"
          class="pz-overline mb-2 text-muted"
        >
          Na ovoj stranici
        </h2>
        <ul class="divide-y divide-default">
          <li
            v-for="[id, label] in contents"
            :key="id"
          >
            <a
              :href="`#${id}`"
              class="block py-3 font-bold text-default underline-offset-2 hover:underline"
            >
              {{ label }}
            </a>
          </li>
        </ul>
      </nav>

      <article class="pz-reading flex flex-col gap-8 text-default">
        <section id="uredaj">
          <h2 class="pz-h2 mb-3 text-highlighted">
            Što ostaje na tvom uređaju
          </h2>
          <p>Ovo se sprema samo u tvoj preglednik i ne šalje se nikamo:</p>
          <ul class="mt-3 list-disc space-y-2 pl-5">
            <li>odabir svijetle ili tamne teme</li>
            <li>napredak u učenju riječi i rezultati igara</li>
            <li>niz riječi dana</li>
            <li>nedavna pretraživanja</li>
            <li>nadimak koji koristiš u izazovima</li>
            <li>nedovršen prilog, da se ne izgubi ako se veza prekine</li>
          </ul>
        </section>

        <section id="posluzitelj">
          <h2 class="pz-h2 mb-3 text-highlighted">
            Što šalješ nama
          </h2>
          <ul class="list-disc space-y-3 pl-5">
            <li><b>Prilozi.</b> Tekst i, ako ih upišeš, ime za potpis i e-pošta. E-pošta služi samo uredniku za pitanja i ne objavljuje se.</li>
            <li><b>Fotografije u prilogu.</b> Ako si prijavljen i pošalješ fotografiju, privremeno pohranjujemo datoteku, opis (alt tekst), ime autora i tvoju potvrdu da smijemo objaviti. Urednik ih vidi u pregledu prije eventualne objave; same datoteke nisu javno dostupne.</li>
            <li><b>Izazovi.</b> Nadimak i rezultat, da ih vide oni s kojima dijeliš kôd izazova. Brišu se 30 dana nakon isteka izazova.</li>
            <li><b>Račun.</b> Ako se prijaviš Googleom, Supabase Auth obrađuje e-mail adresu i tehničke podatke potrebne za sesiju. Javni sadržaj i dalje možeš pregledavati bez računa.</li>
            <li>
              <b>Glavno mjesto.</b> Ako si prijavljen/a, uz račun možeš spremiti jedno glavno mjesto na poslužitelju. Ukloni ga odabirom „Ukloni” u postavkama
              <NuxtLink :to="localePath('/racun/glavno-mjesto/')">Glavno mjesto</NuxtLink>.
              Brisanje podataka s uređaja ne briše glavno mjesto spremljeno uz račun.
            </li>
          </ul>
          <p class="mt-4">
            Za upravljanje uredničkim pristupom spremamo e-poštu i ulogu prijavljenog računa, e-poštu koju administrator prethodno odobri prije prve prijave te revizijski zapis promjena uloga (tko je promijenio ulogu kojeg računa i kada). Ti podaci služe za dodjelu i opoziv uredničkog pristupa.
          </p>
        </section>

        <section id="nema">
          <h2 class="pz-h2 mb-3 text-highlighted">
            Čega nema
          </h2>
          <ul class="list-disc space-y-2 pl-5">
            <li>Nema oglasa ni oglasnih kolačića.</li>
            <li>Nema praćenja među stranicama.</li>
            <li>Slova i ikone poslužujemo sami, bez poziva trećim stranama.</li>
          </ul>
        </section>

        <section id="brisanje">
          <h2 class="pz-h2 mb-3 text-highlighted">
            Kako obrisati podatke
          </h2>
          <p>Sve što je spremljeno na ovom uređaju možeš obrisati jednim pritiskom. Napredak u učenju i rezultati nestat će i ne mogu se vratiti.</p>
          <p class="mt-4">
            <UButton
              label="Obriši podatke s ovog uređaja"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              @click="open = true"
            />
          </p>
          <UAlert
            v-if="deleted"
            class="mt-4"
            title="Podaci s ovog uređaja su obrisani."
            icon="i-lucide-circle-check"
            color="success"
            role="status"
            data-testid="privacy-deleted"
          />
          <p class="mt-4">
            Želiš li da uklonimo prilog koji je poslan nama, javi se uredništvu i navedi oznaku priloga.
          </p>
        </section>

        <section id="kontakt">
          <h2 class="pz-h2 mb-3 text-highlighted">
            Kontakt
          </h2>
          <p>Voditelj obrade podataka je Karlo Siladi. Za pitanja o privatnosti piši na <ULink :to="`mailto:${site.privacyEmail}`">{{ site.privacyEmail }}</ULink>.</p>
          <p class="mt-4">
            <UButton
              :to="localePath(pzRoutes.contribute)"
              label="Natrag na obrazac"
              icon="i-lucide-arrow-left"
              color="neutral"
              variant="subtle"
            />
          </p>
        </section>
      </article>
    </div>

    <AppSheet
      v-model:open="open"
      title="Želiš li obrisati podatke s ovog uređaja?"
      description="Obrisat će se napredak u učenju, rezultati igara, niz riječi dana, nadimak i nedavna pretraživanja. Ovo se ne može poništiti."
      confirmation
    >
      <template #body>
        <p>Obrisat će se napredak u učenju, rezultati igara, niz riječi dana, nadimak i nedavna pretraživanja. Ovo se ne može poništiti.</p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Odustani"
            color="neutral"
            variant="outline"
            @click="open = false"
          />
          <UButton
            label="Obriši podatke"
            color="error"
            @click="forgetDeviceData"
          />
        </div>
      </template>
    </AppSheet>
  </div>
</template>
