-- Seed six historical persons for Learn, Play and public profiles (WP19). Replay-safe: on conflict do nothing.
begin;
set local app.actor = 'import';

insert into public.sources (id, title, type, url, status) values
  (public.content_uuid('source:wiki-marko-krizevcanin'), 'Wikipedija: Marko Križevčanin', 'website', 'https://hr.wikipedia.org/wiki/Marko_Kri%C5%BEev%C4%8Danin', 'published'),
  (public.content_uuid('source:wiki-ivan-vitez-od-sredne'), 'Wikipedija: Ivan Vitez od Sredne', 'website', 'https://hr.wikipedia.org/wiki/Ivan_Vitez_od_Sredne', 'published'),
  (public.content_uuid('source:wiki-antun-nemcic'), 'Wikipedija: Antun Nemčić', 'website', 'https://hr.wikipedia.org/wiki/Antun_Nem%C4%8Di%C4%87', 'published'),
  (public.content_uuid('source:wiki-sidonija-erdody-rubido'), 'Wikipedija: Sidonija Erdődy Rubido', 'website', 'https://hr.wikipedia.org/wiki/Sidonija_Erd%C5%91dy_Rubido', 'published'),
  (public.content_uuid('source:wiki-vladimir-srecko-vrkljan'), 'Wikipedija: Vladimir Srećko Vrkljan', 'website', 'https://hr.wikipedia.org/wiki/Vladimir_Sre%C4%87ko_Vrkljan', 'published'),
  (public.content_uuid('source:spoljar-manojlovic-hrcak'), 'Z. Manojlović: osobni fond Zlatka Špoljara (Državni arhiv u Rijeci)', 'publication', 'https://hrcak.srce.hr/file/330481', 'published')
on conflict (id) do nothing;

insert into public.persons (id, name, slug, role, clue, bio, born, born_year, born_place, died, died_year, died_place, open_questions, research_notes, verification, status) values
  (
    public.content_uuid('person:marko-krizevcanin'),
    'Sveti Marko Križevčanin',
    'marko-krizevcanin',
    'svećenik i mučenik, svetac',
    'Svećenik iz Križevaca, mučenik u Košicama 1619., proglašen svetim 1995.',
    'Svećenik rodom iz Križevaca, mučen i pogubljen u Košicama 1619. Beatificiran 1905., kanoniziran 1995. u Košicama; zaštitnik Biskupije bjelovarsko-križevačke, blagdan 7. rujna.',
    'oko 1588.', 1588, 'Križevci',
    '7. 9. 1619.', 1619, 'Košice',
    'Godina rođenja: 1588. ili 1589. (izvori se razlikuju).',
    '', 'unverified', 'published'
  ),
  (
    public.content_uuid('person:ivan-vitez-od-sredne'),
    'Ivan Vitez od Sredne',
    'ivan-vitez-od-sredne',
    'humanist, ostrogonski nadbiskup',
    'Humanist rodom kraj Križevaca, ostrogonski nadbiskup i ugarski primas.',
    'Humanist rodom kraj Križevaca, biskup Várada (1445–1465), ostrogonski nadbiskup i ugarski primas (1465–1472). Osnovao akademiju i knjižnicu u Budimu te sveučilište u Pozsonju.',
    '1405. ili 1408.', 1405, 'Sredna kraj Križevaca',
    '6. 8. 1472.', 1472, 'Ostrogon',
    'Godina rođenja: 1405. ili 1408.',
    '', 'unverified', 'published'
  ),
  (
    public.content_uuid('person:antun-nemcic'),
    'Antun Nemčić',
    'antun-nemcic',
    'književnik, bilježnik Križevačke županije',
    'Pisac „Putositnica” i komedije „Kvas bez kruha”, bilježnik u Križevcima.',
    'Književnik i bilježnik Križevačke županije. Putositnice jedina je knjiga objavljena za života autora; napisao je i komediju Kvas bez kruha. Umro od kolere u Križevcima 1849.',
    '14. 1. 1813.', 1813, 'Edde (Mađarska)',
    '5. 9. 1849.', 1849, 'Križevci',
    null,
    '', 'unverified', 'published'
  ),
  (
    public.content_uuid('person:sidonija-erdody-rubido'),
    'Sidonija Erdődy Rubido',
    'sidonija-erdody-rubido',
    'operna pjevačica, prva hrvatska primadona',
    'Prva hrvatska primadona, Ljubica u Lisinskijevoj operi „Ljubav i zloba”.',
    'Prva hrvatska operna primadona, utjelovila Ljubicu u Lisinskijevoj operi Ljubav i zloba (premijera 1846.). Od 1863. živjela u Gornjoj Rijeci u dvorcu Erdődy–Rubido, tamo umrla i pokopana uz obiteljsku grobnicu.',
    '7. 2. 1819.', 1819, 'Zagreb',
    '17. 2. 1884.', 1884, 'Gornja Rijeka',
    'Godina smrti: 1884. u tekstu, 1883. u infokutiji izvora.',
    '', 'unverified', 'published'
  ),
  (
    public.content_uuid('person:vladimir-srecko-vrkljan'),
    'Vladimir Srećko Vrkljan',
    'vladimir-srecko-vrkljan',
    'fizičar, filozof i grafolog',
    'Fizičar koji je 1924. napisao prvu disertaciju na hrvatskom o kvantnoj teoriji.',
    'Fizičar, filozof i grafolog rodom iz Svetog Petra Orehovca. 1924. obranio prvu disertaciju na hrvatskom o kvantnoj teoriji.',
    '26. 8. 1894.', 1894, 'Sveti Petar Orehovec',
    '1. 3. 1974.', 1974, 'Zagreb',
    'Članak traži dodatne izvore; potreban drugi izvor.',
    '', 'unverified', 'published'
  ),
  (
    public.content_uuid('person:zlatko-spoljar'),
    'Zlatko Špoljar',
    'zlatko-spoljar',
    'učitelj, skladatelj, pisac i melograf',
    'Učitelj i skladatelj koji je zapisivao narodne pjesme i izdavao dječji list „Čarobno vrelo”.',
    'Učitelj, skladatelj, pisac i melograf rodom iz Miholca. Zapisivao narodne pjesme (Podravina, 1917–18) i izdavao dječji list Čarobno vrelo.',
    '11. 4. 1892.', 1892, 'Miholec',
    '29. 4. 1981.', 1981, 'Opatija',
    null,
    '', 'unverified', 'published'
  )
on conflict (id) do nothing;

insert into public.person_areas (person_id, area_id, role, position) values
  (public.content_uuid('person:marko-krizevcanin'), (select id from public.areas where kind = 'settlement' and slug = 'krizevci'), 'rodjen', 0),
  (public.content_uuid('person:ivan-vitez-od-sredne'), (select id from public.areas where kind = 'town' and slug = 'grad-krizevci'), 'rodjen', 0),
  (public.content_uuid('person:antun-nemcic'), (select id from public.areas where kind = 'settlement' and slug = 'krizevci'), 'djelovao', 0),
  (public.content_uuid('person:antun-nemcic'), (select id from public.areas where kind = 'settlement' and slug = 'krizevci'), 'umro', 1),
  (public.content_uuid('person:sidonija-erdody-rubido'), (select id from public.areas where kind = 'settlement' and slug = 'gornja-rijeka'), 'zivio', 0),
  (public.content_uuid('person:sidonija-erdody-rubido'), (select id from public.areas where kind = 'settlement' and slug = 'gornja-rijeka'), 'umro', 1),
  (public.content_uuid('person:sidonija-erdody-rubido'), (select id from public.areas where kind = 'settlement' and slug = 'gornja-rijeka'), 'pokopan', 2),
  (public.content_uuid('person:vladimir-srecko-vrkljan'), (select id from public.areas where kind = 'settlement' and slug = 'sveti-petar-orehovec'), 'rodjen', 0),
  (public.content_uuid('person:zlatko-spoljar'), (select id from public.areas where kind = 'settlement' and slug = 'miholec'), 'rodjen', 0)
on conflict do nothing;

insert into public.person_heritage_items (person_id, item_id, relation, position) values
  (
    public.content_uuid('person:marko-krizevcanin'),
    (select i.id from public.heritage_items i join public.areas a on a.id = i.settlement_id where a.kind = 'settlement' and a.slug = 'krizevci' and i.slug = 'kapela-sv-marka-krizevcanina'),
    'kapela mu je posvećena', 0
  ),
  (
    public.content_uuid('person:sidonija-erdody-rubido'),
    (select i.id from public.heritage_items i join public.areas a on a.id = i.settlement_id where a.kind = 'settlement' and a.slug = 'gornja-rijeka' and i.slug = 'crkva-uznesenja-blazene-djevice-marije'),
    'obiteljska grobnica uz župnu crkvu', 0
  )
on conflict do nothing;

insert into public.person_sources (person_id, source_id, position) values
  (public.content_uuid('person:marko-krizevcanin'), public.content_uuid('source:wiki-marko-krizevcanin'), 0),
  (public.content_uuid('person:ivan-vitez-od-sredne'), public.content_uuid('source:wiki-ivan-vitez-od-sredne'), 0),
  (public.content_uuid('person:antun-nemcic'), public.content_uuid('source:wiki-antun-nemcic'), 0),
  (public.content_uuid('person:sidonija-erdody-rubido'), public.content_uuid('source:wiki-sidonija-erdody-rubido'), 0),
  (public.content_uuid('person:vladimir-srecko-vrkljan'), public.content_uuid('source:wiki-vladimir-srecko-vrkljan'), 0),
  (public.content_uuid('person:zlatko-spoljar'), public.content_uuid('source:spoljar-manojlovic-hrcak'), 0)
on conflict do nothing;

commit;
