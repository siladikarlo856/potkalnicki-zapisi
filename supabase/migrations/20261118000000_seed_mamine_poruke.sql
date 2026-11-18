-- Seed the reviewed Mama WhatsApp batch as public intangible heritage.
-- Conversation/meta lines stay out; source wording is kept in text_local or a Custom description.
begin;
set local app.actor = 'import';

alter table public.customs
  add column if not exists steps jsonb not null default '[]'::jsonb
  check (jsonb_typeof(steps) = 'array' and octet_length(steps::text) <= 12000);
alter table public.folk_texts
  add column if not exists sensitive boolean not null default false;

insert into public.themes (id, slug, label_hr, label_en, description, sort, status) values (
  public.content_uuid('theme:iz-mamine-poruke'), 'iz-mamine-poruke', 'Iz mamine poruke', 'From Mama''s message',
  'Usmeni tekstovi i dječji običaji zabilježeni u obiteljskoj WhatsApp poruci od 10. do 17. studenoga 2026.', 100, 'published'
) on conflict (id) do nothing;

insert into public.sources (id, title, type, note, status) values (
  public.content_uuid('source:iz-mamine-poruke'), 'WhatsApp razgovor s Mamom, 10.–17. studenoga 2026.', 'interview',
  'Obiteljski zapis. Izvorni izvoz čuva se izvan javne baze; redci razgovora i urednički komentari nisu uneseni kao zapisi.', 'published'
) on conflict (id) do nothing;

-- Public names stay private until the captain confirms consent. Descriptions are intentionally non-identifying.
insert into public.narrators (id, name, slug, public_description, consent_named, living, verification, research_notes, status) values
  (public.content_uuid('narrator:mama'), 'Mama', 'obiteljska-kazivacica', 'kazivačica iz obiteljskog zapisa', false, true, 'in_review', 'Potvrditi želi li kazivačica javno ime ili samo opis.', 'published'),
  (public.content_uuid('narrator:karlo-siladi'), 'Karlo Siladi', 'zapisivac-obiteljskog-zapisa', 'zapisivač obiteljskog zapisa', false, true, 'in_review', 'Potvrditi privolu za javno imenovanje zapisivača.', 'published')
on conflict (id) do nothing;

insert into public.customs (
  id, title, slug, type_id, description, quotes, steps, recorded_precision, recorded_year, recorded_month, recorded_day,
  verification, research_notes, noindex, status
) values
  (public.content_uuid('custom:sayings-palm-line-33'), 'Križ, kraž, Matijaš — igra na dlanu', 'kriz-kraz-matijas-igra-na-dlanu',
   public.content_uuid('custom_type:zivotni-obicaji'),
   'Kažiprstom dijetetu po dlanu radiš križiće i govoriš :"Križ, kraž, Matijaš. Koj mi daš? Puc, puc, puc ti dam, puc ti dam!" Na ovaj zadnji dio se plješće po djetetovom dlanu.',
   jsonb_build_array('Križ, kraž, Matijaš. Koj mi daš? Puc, puc, puc ti dam, puc ti dam!'),
   jsonb_build_array('Kažiprstom djetetu po dlanu radiš križiće.', 'Govoriš: „Križ, kraž, Matijaš. Koj mi daš? Puc, puc, puc ti dam, puc ti dam!”', 'Na zadnji dio plješćeš po djetetovu dlanu.'),
   'day', 2026, 11, 11, 'unverified', 'Izvorni redak 33. Koraci su urednički raspored izvornog opisa; provjeriti s kazivačicom.', false, 'published'),
  (public.content_uuid('custom:sayings-palm-line-62'), 'U plavom lončiću — igra prstima', 'u-plavom-loncicu-igra-prstima',
   public.content_uuid('custom_type:zivotni-obicaji'),
   'Prstom šaraš djetetu po dlanu :"U plavom lončiću se kašica kuhala." Kreće se od palca :"of ide v lov, of za njim, of dom čuva , of jesti kuha , of ide  muzu muzu muzu  ja bum rekel mami meni niste nikaj dali. Puc, puc, puc, puc. (plješće se po dlanu.)',
   jsonb_build_array('U plavom lončiću se kašica kuhala.', 'of ide v lov, of za njim, of dom čuva , of jesti kuha , of ide  muzu muzu muzu  ja bum rekel mami meni niste nikaj dali. Puc, puc, puc, puc.'),
   jsonb_build_array('Prstom šaraš djetetu po dlanu: „U plavom lončiću se kašica kuhala.”', 'Krećeš od palca i redom izgovaraš riječi uz svaki prst.', 'Na kraju plješćeš po dlanu: „Puc, puc, puc, puc.”'),
   'day', 2026, 11, 15, 'unverified', 'Izvorni redak 62. Koraci su urednički raspored izvornog opisa; provjeriti s kazivačicom.', false, 'published'),
  (public.content_uuid('custom:sayings-soothing-line-35'), 'Riječi za utjehu kad se dijete udari', 'rijeci-za-utjehu-kad-se-dijete-udari',
   public.content_uuid('custom_type:zivotni-obicaji'),
   'Kad se dijete udari i plače :"Odi k mene budem ti ja to zvračil." Miluješ ga po mjestu gdje boli i govoriš:"Kad peseka bolji kusica trpi. Kad kusicu bolji pesek trpi. Denes  črljene, zutra bele, pozutra cele..." I to ponoviš par puta jer kad dijete počne slušati zaboravi na bol. Ovo je kulturni zapis riječi i postupka, nije medicinski savjet.',
   jsonb_build_array('Odi k mene budem ti ja to zvračil.', 'Kad peseka bolji kusica trpi. Kad kusicu bolji pesek trpi. Denes  črljene, zutra bele, pozutra cele...'),
   '[]'::jsonb, 'day', 2026, 11, 11, 'unverified', 'Izvorni redak 35. Redak 34 je povezana riječ za slučaj gušenja; provjeriti razdvajanje s kazivačicom.', false, 'published')
on conflict (id) do nothing;

with entries(line_key, title, type_key, custom_key, text_local, text_standard, sensitive, verification, recorded_year, recorded_month, recorded_day, research_notes) as (values
    ('1', 'Ajmo spat Boga zvat na on kraj gde je sveti raj. Gde Marija sinka ziblje. Sinek moj jel…', 'molitva', NULL, 'Ajmo spat Boga zvat na on kraj gde je sveti raj. Gde Marija sinka ziblje. Sinek moj jel spiš il glediš? Nit spim nit gledim za verne dušice skrbim.', 'Nacrt: Idemo spavati i zazvati Boga ondje gdje je sveti raj; Marija ljulja sina, a sin kaže da ne spava nego brine za vjerne duše.', false, 'unverified', 2026, 11, 10, 'Izvorni redak 1 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('2', 'Šte ima strica, te sa lakše i v nebe dosmica.', 'poslovica-izreka', NULL, 'Šte ima strica, te sa lakše i v nebe dosmica.', 'Nacrt: Tko ima strica, lakše će stići u nebo.', false, 'unverified', 2026, 11, 10, 'Izvorni redak 2 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('3', 'Bolje ništ, nek gemišt!', 'poslovica-izreka', NULL, 'Bolje ništ, nek gemišt!', 'Nacrt: Bolje gemišt nego ništa.', false, 'unverified', 2026, 11, 10, 'Izvorni redak 3 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('4', 'Da je voda dobra, žaba bi bila kak konj.', 'poslovica-izreka', NULL, 'Da je voda dobra, žaba bi bila kak konj.', 'Nacrt: Kad bi voda bila dobra, žaba bi bila kao konj.', false, 'unverified', 2026, 11, 10, 'Izvorni redak 4 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('5', 'Naj biti kaj krava koja da pune mljeka, a nazanje se ritne i se razljeje.', 'poslovica-izreka', NULL, 'Naj biti kaj krava koja da pune mljeka, a nazanje se ritne i se razljeje.', 'Nacrt: Nemoj biti kao krava koja daje puno mlijeka pa se na kraju ritne i sve prolije.', false, 'unverified', 2026, 11, 10, 'Izvorni redak 5 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('6', 'Nit je gda imel šustar cipelje, nit šnajdar odele.', 'poslovica-izreka', NULL, 'Nit je gda imel šustar cipelje, nit šnajdar odele.', NULL, false, 'unverified', 2026, 11, 10, 'Izvorni redak 6 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('7', 'Bota navek ima dva kraje.', 'poslovica-izreka', NULL, 'Bota navek ima dva kraje.', NULL, false, 'unverified', 2026, 11, 10, 'Izvorni redak 7 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('8', 'Za dobru prasicu nema lošeg napoja.', 'poslovica-izreka', NULL, 'Za dobru prasicu nema lošeg napoja.', NULL, false, 'unverified', 2026, 11, 10, 'Izvorni redak 8 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('9', 'Bedek si bil, bedak buš ostal.', 'poslovica-izreka', NULL, 'Bedek si bil, bedak buš ostal.', NULL, false, 'unverified', 2026, 11, 11, 'Izvorni redak 9 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('10', 'Bedaku vrganji i na ceste rasteju', 'poslovica-izreka', NULL, 'Bedaku vrganji i na ceste rasteju', NULL, false, 'unverified', 2026, 11, 11, 'Izvorni redak 10 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('11', 'Šte se zna snajti ni na šekretu nebu gladen ostal.', 'poslovica-izreka', NULL, 'Šte se zna snajti ni na šekretu nebu gladen ostal.', NULL, false, 'unverified', 2026, 11, 11, 'Izvorni redak 11 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('12', 'Nigdar se jedna prasica sama nebu na kopanje grizla.', 'poslovica-izreka', NULL, 'Nigdar se jedna prasica sama nebu na kopanje grizla.', NULL, false, 'unverified', 2026, 11, 11, 'Izvorni redak 12 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('13', 'Naj se z bedaka delati norca.', 'poslovica-izreka', NULL, 'Naj se z bedaka delati norca.', NULL, false, 'unverified', 2026, 11, 11, 'Izvorni redak 13 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('14', 'Tat tatu nigdar ne veruje.', 'poslovica-izreka', NULL, 'Tat tatu nigdar ne veruje.', NULL, false, 'unverified', 2026, 11, 11, 'Izvorni redak 14 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('15', 'Pune bab - kilave dete', 'poslovica-izreka', NULL, 'Pune bab - kilave dete', NULL, false, 'unverified', 2026, 11, 11, 'Izvorni redak 15 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('16', 'Zdravi betežnomu ne veruje.', 'poslovica-izreka', NULL, 'Zdravi betežnomu ne veruje.', NULL, false, 'unverified', 2026, 11, 11, 'Izvorni redak 16 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('17', 'Betežni zdravoga nesi.', 'poslovica-izreka', NULL, 'Betežni zdravoga nesi.', NULL, false, 'unverified', 2026, 11, 11, 'Izvorni redak 17 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('18', 'Zglediš kak da nesi prežgane juhe jel.', 'poslovica-izreka', NULL, 'Zglediš kak da nesi prežgane juhe jel.', NULL, false, 'in_review', 2026, 11, 11, 'Izvorni redak 18 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('19', 'Koj bu - da bu.', 'poslovica-izreka', NULL, 'Koj bu - da bu.', NULL, false, 'in_review', 2026, 11, 11, 'Izvorni redak 19 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('20', 'I ćorava kokoš najde zrne.', 'poslovica-izreka', NULL, 'I ćorava kokoš najde zrne.', NULL, false, 'unverified', 2026, 11, 11, 'Izvorni redak 20 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('21', 'Ni sunce ni mesečina ga nesmeju videti.', 'poslovica-izreka', NULL, 'Ni sunce ni mesečina ga nesmeju videti.', NULL, false, 'in_review', 2026, 11, 11, 'Izvorni redak 21 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('22', 'Am  si kaj bistrički bogec.', 'poslovica-izreka', NULL, 'Am  si kaj bistrički bogec.', NULL, false, 'in_review', 2026, 11, 11, 'Izvorni redak 22 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('23', 'Dok bedak ima penez i kramari tržiju.', 'poslovica-izreka', NULL, 'Dok bedak ima penez i kramari tržiju.', NULL, false, 'unverified', 2026, 11, 11, 'Izvorni redak 23 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('24', 'To ti je porez na bedake.', 'poslovica-izreka', NULL, 'To ti je porez na bedake.', NULL, false, 'unverified', 2026, 11, 11, 'Izvorni redak 24 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('25', 'Opal je s konja na magarca.', 'poslovica-izreka', NULL, 'Opal je s konja na magarca.', NULL, false, 'unverified', 2026, 11, 11, 'Izvorni redak 25 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('26', 'Bolje ti je šuteti i pameten biti.', 'poslovica-izreka', NULL, 'Bolje ti je šuteti i pameten biti.', NULL, false, 'unverified', 2026, 11, 11, 'Izvorni redak 26 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('29', 'Batina je v nebu zrasla.', 'poslovica-izreka', NULL, 'Batina je v nebu zrasla.', NULL, false, 'in_review', 2026, 11, 11, 'Izvorni redak 29 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('30', 'Nit sem krop, nit sem voda.', 'poslovica-izreka', NULL, 'Nit sem krop, nit sem voda.', NULL, false, 'in_review', 2026, 11, 11, 'Izvorni redak 30 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('31', 'Tiha voda brege dere.', 'poslovica-izreka', NULL, 'Tiha voda brege dere.', NULL, false, 'unverified', 2026, 11, 11, 'Izvorni redak 31 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('32', 'A dogodi se! Kak i dekle dete', 'poslovica-izreka', NULL, 'A dogodi se! Kak i dekle dete', NULL, false, 'in_review', 2026, 11, 11, 'Izvorni redak 32 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('34', 'Križi boži, Bog prekriži.', 'kletva-blagoslov', 'sayings-soothing-line-35', 'Križi boži, Bog prekriži.', 'Nacrt: Kad se dijete zagrcne, govori se „Križi boži, Bog prekriži.” Ovo je kulturni zapis riječi, nije medicinski savjet.', false, 'in_review', 2026, 11, 11, 'Izvorni redak 34 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('36', 'Koj babe gude, bile je i bude.', 'poslovica-izreka', NULL, 'Koj babe gude, bile je i bude.', NULL, false, 'in_review', 2026, 11, 11, 'Izvorni redak 36 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('37', 'Trntrljerom, pokrijte ga z guberom. Hitite ga preko plota da se dime ne dokota.', 'pjesma', NULL, 'Trntrljerom, pokrijte ga z guberom. Hitite ga preko plota da se dime ne dokota.', 'Nacrt: Pjesmica koju je djed pjevao dok smo bili mali.', false, 'unverified', 2026, 11, 11, 'Izvorni redak 37 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('38', 'Enci, benci pokamenci tu se šeću tri mladenci, am bam kapetan jedan ide s kola van.', 'brojalica', NULL, 'Enci, benci pokamenci tu se šeću tri mladenci, am bam kapetan jedan ide s kola van.', 'Nacrt: Brojalica za biranje ili ritam igre.', false, 'unverified', 2026, 11, 11, 'Izvorni redak 38 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('39', 'Ekete pekete pik ma đura sara sira josta đura josta dina josta točka jaje snjela kvočka.', 'brojalica', NULL, 'Ekete pekete pik ma đura sara sira josta đura josta dina josta točka jaje snjela kvočka.', 'Nacrt: Brojalica za biranje ili ritam igre.', false, 'unverified', 2026, 11, 11, 'Izvorni redak 39 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('40', 'Bokčija siromaštve nadvladala', 'poslovica-izreka', NULL, 'Bokčija siromaštve nadvladala', NULL, false, 'unverified', 2026, 11, 12, 'Izvorni redak 40 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('41', 'Op cup na kalup četri babe jedan zup.', 'pjesma', NULL, 'Op cup na kalup četri babe jedan zup.', 'Nacrt: Dječja pjesmica.', false, 'unverified', 2026, 11, 12, 'Izvorni redak 41 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('42', 'Sit gladnomu ne veruje.', 'poslovica-izreka', NULL, 'Sit gladnomu ne veruje.', NULL, false, 'unverified', 2026, 11, 12, 'Izvorni redak 42 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('43', 'Naj se kititi s tuđem perjem.', 'poslovica-izreka', NULL, 'Naj se kititi s tuđem perjem.', NULL, false, 'unverified', 2026, 11, 12, 'Izvorni redak 43 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('44', 'Išče posel, a Boga molji da ga ne najde.', 'poslovica-izreka', NULL, 'Išče posel, a Boga molji da ga ne najde.', NULL, false, 'unverified', 2026, 11, 12, 'Izvorni redak 44 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('46', 'Poslovica o kozi', 'poslovica-izreka', NULL, 'Da koza ima duge rep bi si ga posrala', 'Nacrt: Tko bi imao dugu kozu, sama bi si ga uprljala.', true, 'unverified', 2026, 11, 12, 'Izvorni redak 46 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('53', 'Imaš više sreće nek pameti', 'poslovica-izreka', NULL, 'Imaš više sreće nek pameti', NULL, false, 'unverified', 2026, 11, 12, 'Izvorni redak 53 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('54', 'Izreka o slaganju', 'poslovica-izreka', NULL, 'Nemereš složiti z dreka biks', 'Nacrt: Ne možeš složiti nešto dobro od lošeg materijala.', true, 'unverified', 2026, 11, 12, 'Izvorni redak 54 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('57', 'Navek su čerešnje v tuđem trnacu slajše.', 'poslovica-izreka', NULL, 'Navek su čerešnje v tuđem trnacu slajše.', NULL, false, 'unverified', 2026, 11, 13, 'Izvorni redak 57 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('58', 'Bolje da nestane sela nek obićaja.', 'poslovica-izreka', NULL, 'Bolje da nestane sela nek obićaja.', NULL, false, 'unverified', 2026, 11, 14, 'Izvorni redak 58 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('59', 'Dober i bedak su si braća.', 'poslovica-izreka', NULL, 'Dober i bedak su si braća.', NULL, false, 'unverified', 2026, 11, 14, 'Izvorni redak 59 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('60', 'Reč i veter...', 'poslovica-izreka', NULL, 'Reč i veter...', NULL, false, 'in_review', 2026, 11, 15, 'Izvorni redak 60 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('61', 'Ni si prsti na ruke nesu isti.', 'poslovica-izreka', NULL, 'Ni si prsti na ruke nesu isti.', NULL, false, 'unverified', 2026, 11, 15, 'Izvorni redak 61 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('63', 'Ja mu dam prst, a on oće celu ruku.', 'poslovica-izreka', NULL, 'Ja mu dam prst, a on oće celu ruku.', NULL, false, 'unverified', 2026, 11, 15, 'Izvorni redak 63 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('64', 'Koj bi debele guske vrat mazal.', 'poslovica-izreka', NULL, 'Koj bi debele guske vrat mazal.', NULL, false, 'unverified', 2026, 11, 15, 'Izvorni redak 64 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('65', 'Šte polake ide dalje zajde.', 'poslovica-izreka', NULL, 'Šte polake ide dalje zajde.', NULL, false, 'unverified', 2026, 11, 15, 'Izvorni redak 65 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('66', 'Ide kak da koga čaka.', 'poslovica-izreka', NULL, 'Ide kak da koga čaka.', NULL, false, 'in_review', 2026, 11, 15, 'Izvorni redak 66 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('67', 'Fljeten je kak da krta čaka.', 'poslovica-izreka', NULL, 'Fljeten je kak da krta čaka.', NULL, false, 'in_review', 2026, 11, 15, 'Izvorni redak 67 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('68', 'Kakov otec takov sin, kakva koza tak beći.', 'poslovica-izreka', NULL, 'Kakov otec takov sin, kakva koza tak beći.', NULL, false, 'unverified', 2026, 11, 15, 'Izvorni redak 68 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('69', 'Izreka o ruži', 'poslovica-izreka', NULL, 'V rožu cilja, v drek zgodi 🫣😁', NULL, true, 'in_review', 2026, 11, 15, 'Izvorni redak 69 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('70', 'Bolje vrabec v ruke, nek golub na grane.', 'poslovica-izreka', NULL, 'Bolje vrabec v ruke, nek golub na grane.', NULL, false, 'unverified', 2026, 11, 15, 'Izvorni redak 70 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('71', 'Dok mačka miša lovi čvrste ga drži.', 'poslovica-izreka', NULL, 'Dok mačka miša lovi čvrste ga drži.', NULL, false, 'unverified', 2026, 11, 15, 'Izvorni redak 71 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('72', 'V sonce i v punicu se nemere gledeti.', 'poslovica-izreka', NULL, 'V sonce i v punicu se nemere gledeti.', NULL, false, 'unverified', 2026, 11, 15, 'Izvorni redak 72 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('73', 'Vine se pije, a z vodu lice mije.', 'poslovica-izreka', NULL, 'Vine se pije, a z vodu lice mije.', NULL, false, 'unverified', 2026, 11, 15, 'Izvorni redak 73 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('74', 'Pes ne laje radi sela, nek radi sebe.', 'poslovica-izreka', NULL, 'Pes ne laje radi sela, nek radi sebe.', NULL, false, 'unverified', 2026, 11, 15, 'Izvorni redak 74 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('75', 'Imaš putra na glave.', 'poslovica-izreka', NULL, 'Imaš putra na glave.', NULL, false, 'in_review', 2026, 11, 15, 'Izvorni redak 75 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('76', 'Teknul si je prste v pekmez.', 'poslovica-izreka', NULL, 'Teknul si je prste v pekmez.', NULL, false, 'in_review', 2026, 11, 15, 'Izvorni redak 76 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('77', 'Pinklec na pleča i pot pod noge.', 'poslovica-izreka', NULL, 'Pinklec na pleča i pot pod noge.', NULL, false, 'in_review', 2026, 11, 15, 'Izvorni redak 77 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('78', 'Denes se digel na ljevu nogu.', 'poslovica-izreka', NULL, 'Denes se digel na ljevu nogu.', NULL, false, 'in_review', 2026, 11, 15, 'Izvorni redak 78 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('79', 'Ti se kuntić obesil  na pleća?', 'poslovica-izreka', NULL, 'Ti se kuntić obesil  na pleća?', NULL, false, 'in_review', 2026, 11, 15, 'Izvorni redak 79 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('80a', 'Dok grmi - Bogek kamenje kutura.', 'poslovica-izreka', NULL, 'Dok grmi - Bogek kamenje kutura.', NULL, false, 'in_review', 2026, 11, 15, 'Izvorni redak 80 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('80b', 'Sveti Ilija se s kolji po nebu vojzi.', 'poslovica-izreka', NULL, 'Sveti Ilija se s kolji po nebu vojzi.', NULL, false, 'in_review', 2026, 11, 15, 'Izvorni redak 80 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('80c', 'Dok je dijete bilo zločesto - Bogek ti bu na glavu kamen hitil.', 'poslovica-izreka', NULL, 'Dok je dijete bilo zločesto - Bogek ti bu na glavu kamen hitil.', 'Nacrt: Kad je dijete bilo zločesto, govorilo mu se da će mu Bogek baciti kamen na glavu.', false, 'unverified', 2026, 11, 15, 'Izvorni redak 80 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('80d', 'Bu došel Bakać i odnesel te.', 'poslovica-izreka', NULL, 'Bu došel Bakać i odnesel te.', NULL, false, 'unverified', 2026, 11, 15, 'Izvorni redak 80 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('80e', 'Buš videl dok ti dojde teca nevolja.', 'poslovica-izreka', NULL, 'Buš videl dok ti dojde teca nevolja.', NULL, false, 'in_review', 2026, 11, 15, 'Izvorni redak 80 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('80f', 'Došel bu vuk i bu te pojel.', 'poslovica-izreka', NULL, 'Došel bu vuk i bu te pojel.', NULL, false, 'unverified', 2026, 11, 15, 'Izvorni redak 80 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('81', 'Lud čovek - gotova robija.', 'poslovica-izreka', NULL, 'Lud čovek - gotova robija.', NULL, false, 'unverified', 2026, 11, 15, 'Izvorni redak 81 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('82', 'Šte srama nema i sveta se žije.', 'poslovica-izreka', NULL, 'Šte srama nema i sveta se žije.', NULL, false, 'unverified', 2026, 11, 15, 'Izvorni redak 82 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('83', 'Sram ga je kak i kobilu dok je vojz prehitila.', 'poslovica-izreka', NULL, 'Sram ga je kak i kobilu dok je vojz prehitila.', NULL, false, 'unverified', 2026, 11, 15, 'Izvorni redak 83 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('84', 'Skopaj si oke pa buš videl Zagreb.', 'poslovica-izreka', NULL, 'Skopaj si oke pa buš videl Zagreb.', NULL, false, 'unverified', 2026, 11, 16, 'Izvorni redak 84 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('85', 'Ima te rat kaj trn petu.', 'poslovica-izreka', NULL, 'Ima te rat kaj trn petu.', NULL, false, 'in_review', 2026, 11, 16, 'Izvorni redak 85 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('86', 'Izreka o jutru', 'poslovica-izreka', NULL, 'Ljepe jutre - posran dan. 🫣😁', NULL, true, 'unverified', 2026, 11, 16, 'Izvorni redak 86 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('87', 'Tič koji rane popeva do večeri se v gnjezde posere 🫣😁', 'poslovica-izreka', NULL, 'Tič koji rane popeva do večeri se v gnjezde posere 🫣😁', NULL, false, 'in_review', 2026, 11, 16, 'Izvorni redak 87 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('88', 'Držiš se kak da ti je pura kruh zela.', 'poslovica-izreka', NULL, 'Držiš se kak da ti je pura kruh zela.', NULL, false, 'in_review', 2026, 11, 16, 'Izvorni redak 88 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('89', 'Jel si se jutre na koprive poscal? 🫣😁', 'poslovica-izreka', NULL, 'Jel si se jutre na koprive poscal? 🫣😁', NULL, false, 'in_review', 2026, 11, 16, 'Izvorni redak 89 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('90', 'Poslovica o plotu', 'poslovica-izreka', NULL, 'Najlakše je s tuđim k..... po plotu tuči', 'Nacrt: Najlakše je tuđim spolovilom tući po plotu.', true, 'unverified', 2026, 11, 16, 'Izvorni redak 90 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('91', 'Izreka o natpisu na plotu', 'poslovica-izreka', NULL, 'Pisale je i na plotu p..... pak je jeden probal pa se je zguljil', 'Nacrt: I na plotu je bilo napisano nešto prosto, pa je jedan pokušao i ogulio se.', true, 'unverified', 2026, 11, 16, 'Izvorni redak 91 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('93', 'Stari ljudi i mala deca.', 'poslovica-izreka', NULL, 'Stari ljudi i mala deca.', NULL, false, 'in_review', 2026, 11, 17, 'Izvorni redak 93 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('94', 'Će vrag ima pekel ima i brigu na njega.', 'poslovica-izreka', NULL, 'Će vrag ima pekel ima i brigu na njega.', NULL, false, 'in_review', 2026, 11, 17, 'Izvorni redak 94 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); klasifikacija i nacrt značenja su U provjeri.'),
    ('33-text', 'Križ, kraž, Matijaš', 'brojalica', 'sayings-palm-line-33', 'Križ, kraž, Matijaš. Koj mi daš? Puc, puc, puc ti dam, puc ti dam!', 'Nacrt riječi igre; provjeriti s kazivačicom.', false, 'unverified', 2026, 11, 11, 'Izvorni redak 33 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('35-text', 'Odi k mene budem ti ja to zvračil.', 'kletva-blagoslov', 'sayings-soothing-line-35', 'Odi k mene budem ti ja to zvračil. Kad peseka bolji kusica trpi. Kad kusicu bolji pesek trpi. Denes  črljene, zutra bele, pozutra cele...', 'Nacrt riječi utjehe; opis postupka ostaje uz običaj i nije medicinski savjet.', false, 'unverified', 2026, 11, 11, 'Izvorni redak 35 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.'),
    ('62-text', 'U plavom lončiću se kašica kuhala.', 'brojalica', 'sayings-palm-line-62', 'U plavom lončiću se kašica kuhala. of ide v lov, of za njim, of dom čuva , of jesti kuha , of ide  muzu muzu muzu  ja bum rekel mami meni niste nikaj dali. Puc, puc, puc, puc.', 'Nacrt riječi igre; raspored prstiju i pljesak ostaju uz običaj.', false, 'unverified', 2026, 11, 15, 'Izvorni redak 62 iz WhatsApp izvoza s Mamom (10.–17. studenoga 2026.); nacrt značenja treba provjeriti s kazivačicom.')
)
insert into public.folk_texts (
  id, title, slug, type_id, custom_id, text_local, text_standard, recorded_precision, recorded_year, recorded_month, recorded_day,
  sensitive, verification, research_notes, noindex, status
)
select public.content_uuid('folk_text:sayings-' || line_key), title, 'iz-mamine-poruke-' || line_key,
  public.content_uuid('folk_text_type:' || type_key),
  case when custom_key is null then null else public.content_uuid('custom:' || custom_key) end,
  text_local, text_standard, 'day', recorded_year, recorded_month, recorded_day, sensitive, verification, research_notes, false, 'published'
from entries
on conflict (id) do nothing;

-- A rendering is an editorial draft even when the record's classification is not itself uncertain.
update public.folk_texts
set verification = 'in_review'
where slug like 'iz-mamine-poruke-%'
  and text_standard is not null
  and verification = 'unverified';

insert into public.custom_narrators (custom_id, narrator_id, role, position)
select id, public.content_uuid('narrator:mama'), 'narrator', 0 from public.customs
where slug in ('kriz-kraz-matijas-igra-na-dlanu', 'u-plavom-loncicu-igra-prstima', 'rijeci-za-utjehu-kad-se-dijete-udari')
on conflict do nothing;
insert into public.custom_narrators (custom_id, narrator_id, role, position)
select id, public.content_uuid('narrator:karlo-siladi'), 'collector', 1 from public.customs
where slug in ('kriz-kraz-matijas-igra-na-dlanu', 'u-plavom-loncicu-igra-prstima', 'rijeci-za-utjehu-kad-se-dijete-udari')
on conflict do nothing;
insert into public.custom_themes (custom_id, theme_id, position)
select id, public.content_uuid('theme:iz-mamine-poruke'), 0 from public.customs
where slug in ('kriz-kraz-matijas-igra-na-dlanu', 'u-plavom-loncicu-igra-prstima', 'rijeci-za-utjehu-kad-se-dijete-udari')
on conflict do nothing;
insert into public.custom_sources (custom_id, source_id, position)
select id, public.content_uuid('source:iz-mamine-poruke'), 0 from public.customs
where slug in ('kriz-kraz-matijas-igra-na-dlanu', 'u-plavom-loncicu-igra-prstima', 'rijeci-za-utjehu-kad-se-dijete-udari')
on conflict do nothing;

insert into public.folk_text_narrators (folk_text_id, narrator_id, role, position)
select id, public.content_uuid('narrator:mama'), 'narrator', 0 from public.folk_texts where slug like 'iz-mamine-poruke-%'
on conflict do nothing;
insert into public.folk_text_narrators (folk_text_id, narrator_id, role, position)
select id, public.content_uuid('narrator:karlo-siladi'), 'collector', 1 from public.folk_texts where slug like 'iz-mamine-poruke-%'
on conflict do nothing;
insert into public.folk_text_themes (folk_text_id, theme_id, position)
select id, public.content_uuid('theme:iz-mamine-poruke'), 0 from public.folk_texts where slug like 'iz-mamine-poruke-%'
on conflict do nothing;
insert into public.folk_text_sources (folk_text_id, source_id, position)
select id, public.content_uuid('source:iz-mamine-poruke'), 0 from public.folk_texts where slug like 'iz-mamine-poruke-%'
on conflict do nothing;

commit;
