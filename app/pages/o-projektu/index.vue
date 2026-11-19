<script setup lang="ts">
definePageMeta({ layout: 'potkalnicko' })
defineI18nRoute({ locales: ['hr'] })

const { t } = useI18n()
const localePath = useLocalePath()
const { site } = useAppConfig()

useSeoMeta({
  title: () => t('pz.about.title'),
  ogTitle: () => `${t('pz.about.title')} · Potkalnički zapisi`,
  ogDescription: () => 'Digitalni arhiv kraja pod Kalnikom.',
  description: () => 'Digitalni arhiv kraja pod Kalnikom.'
})

const contents = [
  ['sto', 'Što arhiv obuhvaća'],
  ['provjera', 'Kako provjeravamo zapise'],
  ['zastita', 'Što znači oznaka zaštite'],
  ['uzorak', 'Što je uzorak'],
  ['doprinos', 'Kako možeš pomoći'],
  ['tko', 'Tko stoji iza arhiva'],
  ['licencije', 'Licencije'],
  ['kontakt', 'Kontakt']
] as const
</script>

<template>
  <div class="mx-auto flex w-full max-w-(--pz-page-max) flex-col gap-8 px-4 py-6 lg:px-12 lg:py-12">
    <PageHead
      :title="t('pz.about.title')"
      lead="Potkalnički zapisi su digitalni arhiv kraja pod Kalnikom. Skupljamo ono što se zna o mjestima, građevinama, ljudima, običajima i govoru, provjeravamo to i čuvamo na jednom mjestu."
    />

    <div class="grid gap-8 lg:grid-cols-[240px_minmax(0,66ch)] lg:items-start lg:justify-center lg:gap-12">
      <nav
        class="rounded-(--pz-radius-lg) border border-default bg-default p-4 lg:sticky lg:top-20"
        aria-labelledby="about-contents"
      >
        <h2
          id="about-contents"
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
        <section id="sto">
          <h2 class="pz-h2 mb-3 text-highlighted">
            Što arhiv obuhvaća
          </h2>
          <p>Tri općine i jedan grad: Općinu Kalnik, Općinu Sveti Petar Orehovec, Općinu Gornja Rijeka i Grad Križevci, sa svim njihovim naseljima.</p>
          <PzSchematicMap
            labels
            class="my-4"
            label="Shematska karta triju općina i grada Križevaca s grebenom Kalnika"
          />
          <p class="mt-4">
            Zapisi su raspoređeni u pet odjeljaka:
            <ULink :to="localePath(pzRoutes.places)">Mjesta</ULink>,
            <ULink :to="localePath(pzRoutes.heritage)">Baština</ULink>,
            <ULink :to="localePath(pzRoutes.intangible)">Priče i običaji</ULink>,
            <ULink :to="localePath(pzRoutes.persons)">Osobe</ULink> i
            <ULink :to="localePath(pzRoutes.speech)">Govor</ULink>. Uz arhiv idu
            <ULink :to="localePath(pzRoutes.games)">igre i učenje</ULink>, da se zapisano ne samo čuva nego i pamti.
          </p>
        </section>

        <section id="provjera">
          <h2 class="pz-h2 mb-3 text-highlighted">
            Kako provjeravamo zapise
          </h2>
          <p>Uz svaki zapis stoji oznaka koja govori je li ga urednik usporedio s izvorima.</p>
          <ul class="mt-4 flex flex-col gap-4">
            <li>
              <PzVerificationStamp state="pend" />
              <p class="mt-1">
                Zapis je unesen, ali ga još nitko nije usporedio s izvorima. Čitaj ga s oprezom.
              </p>
            </li>
            <li>
              <PzVerificationStamp state="ok" />
              <p class="mt-1">
                Podaci su uspoređeni s navedenim izvorima i točni su koliko znamo. Uz oznaku stoji datum zadnje provjere.
              </p>
            </li>
            <li>
              <PzVerificationStamp state="warn" />
              <p class="mt-1">
                Zapis je bio provjeren, ali je od tada prošlo više od tri godine ili se nešto moglo promijeniti.
              </p>
            </li>
          </ul>
        </section>

        <section id="zastita">
          <h2 class="pz-h2 mb-3 text-highlighted">
            Što znači oznaka zaštite
          </h2>
          <p>Oznaka zaštite ne govori o našem tekstu, nego o samoj građevini: je li upisana u Registar kulturnih dobara Republike Hrvatske. Zato izgleda drukčije i stoji među podacima o građevini.</p>
          <ul class="mt-4 flex flex-col gap-4">
            <li>
              <PzProtectionPlaque
                status="z"
                number="Z-1234"
                block
              />
              <p class="mt-1">
                Trajno zaštićeno dobro. Broj počinje slovom Z.
              </p>
            </li>
            <li>
              <PzProtectionPlaque
                status="p"
                number="P-5678"
                block
              />
              <p class="mt-1">
                Privremena zaštita dok se ne donese konačna odluka. Broj počinje slovom P.
              </p>
            </li>
            <li>
              <PzProtectionPlaque
                status="u"
                block
              />
              <p class="mt-1">
                Ne znamo je li građevina zaštićena. To ne znači da nije.
              </p>
            </li>
          </ul>
        </section>

        <section id="uzorak">
          <h2 class="pz-h2 mb-3 text-highlighted">
            Što je uzorak
          </h2>
          <p><PzSampleLabel class="mr-1 align-middle" /> označava ogledni sadržaj koji pokazuje kako će stranica izgledati. Nije provjeren i ne treba ga navoditi kao izvor. Pravi zapis zamijeni ga čim bude spreman.</p>
        </section>

        <section id="doprinos">
          <h2 class="pz-h2 mb-3 text-highlighted">
            Kako možeš pomoći
          </h2>
          <p>Pošalji zapis, ispravak, izvor, fotografiju ili riječ. Ne moraš znati sve: i jedna rečenica pomaže. Svaki prilog pregleda urednik prije objave.</p>
          <p class="mt-4">
            <UButton
              :to="localePath(pzRoutes.contribute)"
              label="Pošalji zapis"
              icon="i-lucide-pen-line"
            />
          </p>
        </section>

        <section id="tko">
          <h2 class="pz-h2 mb-3 text-highlighted">
            Tko stoji iza arhiva
          </h2>
          <p>Projekt vodi Karlo Siladi iz Križevaca — inženjer i poduzetnik koji ga gradi kao javnu, besplatnu aplikaciju za svoj kraj.</p>
        </section>

        <section id="licencije">
          <span
            id="izvori"
            class="block scroll-mt-24"
            aria-hidden="true"
          />
          <h2 class="pz-h2 mb-3 text-highlighted">
            Licencije
          </h2>
          <p>Tekstovi i fotografije imaju svaka svoje uvjete korištenja. Fotografije imaju autora i licenciju na stranici <ULink :to="localePath(pzRoutes.aboutPhotos)">Fotografije i autori</ULink>.</p>
        </section>

        <section id="kontakt">
          <h2 class="pz-h2 mb-3 text-highlighted">
            Kontakt
          </h2>
          <p>Za pitanja o zapisima koristi obrazac <ULink :to="localePath(pzRoutes.contribute)">Doprinesi</ULink>. Za sve ostalo piši na <ULink :to="`mailto:${site.privacyEmail}`">{{ site.privacyEmail }}</ULink>.</p>
        </section>
      </article>
    </div>
  </div>
</template>
