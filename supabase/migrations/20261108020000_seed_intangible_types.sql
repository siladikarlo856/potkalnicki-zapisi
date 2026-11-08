-- Seed the type lists of intangible heritage with the values of the agreed design. Replay-safe: on conflict do
-- nothing, so an editor's later renames and additions are never overwritten. No Occasions, Themes or example
-- records are seeded: those are the editors' to create, and nothing here is sample content.
--
-- Ids are content_uuid('<table>:<key>'), the same for every environment. Revisions are recorded as 'import'.
begin;
set local app.actor = 'import';

insert into public.story_types (id, key, label_hr, label_en, sort, status) values
  (public.content_uuid('story_type:legenda-predaja'), 'legenda-predaja', 'legenda/predaja', 'legend/tradition', 10, 'published'),
  (public.content_uuid('story_type:mitska-predaja'), 'mitska-predaja', 'mitska predaja', 'mythical tradition', 20, 'published'),
  (public.content_uuid('story_type:bajka'), 'bajka', 'bajka', 'fairy tale', 30, 'published'),
  (public.content_uuid('story_type:saljiva-prica'), 'saljiva-prica', 'šaljiva priča', 'humorous story', 40, 'published'),
  (public.content_uuid('story_type:zivotna-prica'), 'zivotna-prica', 'životna priča', 'life story', 50, 'published')
on conflict (key) do nothing;

insert into public.custom_types (id, key, label_hr, label_en, sort, status) values
  (public.content_uuid('custom_type:godisnji-obicaji'), 'godisnji-obicaji', 'godišnji običaji', 'annual customs', 10, 'published'),
  (public.content_uuid('custom_type:zivotni-obicaji'), 'zivotni-obicaji', 'životni običaji', 'life-cycle customs', 20, 'published'),
  (public.content_uuid('custom_type:rad-i-svakodnevica'), 'rad-i-svakodnevica', 'rad i svakodnevica', 'work and everyday life', 30, 'published'),
  (public.content_uuid('custom_type:vjera-i-poboznost'), 'vjera-i-poboznost', 'vjera i pobožnost', 'faith and devotion', 40, 'published'),
  (public.content_uuid('custom_type:drustveni-zivot'), 'drustveni-zivot', 'društveni život', 'social life', 50, 'published')
on conflict (key) do nothing;

insert into public.folk_text_types (id, key, label_hr, label_en, sort, status) values
  (public.content_uuid('folk_text_type:pjesma'), 'pjesma', 'pjesma', 'song', 10, 'published'),
  (public.content_uuid('folk_text_type:molitva'), 'molitva', 'molitva', 'prayer', 20, 'published'),
  (public.content_uuid('folk_text_type:poslovica-izreka'), 'poslovica-izreka', 'poslovica/izreka', 'proverb/saying', 30, 'published'),
  (public.content_uuid('folk_text_type:zagonetka'), 'zagonetka', 'zagonetka', 'riddle', 40, 'published'),
  (public.content_uuid('folk_text_type:brojalica'), 'brojalica', 'brojalica', 'counting rhyme', 50, 'published'),
  (public.content_uuid('folk_text_type:kletva-blagoslov'), 'kletva-blagoslov', 'kletva/blagoslov', 'curse/blessing', 60, 'published'),
  (public.content_uuid('folk_text_type:zdravica'), 'zdravica', 'zdravica', 'toast', 70, 'published')
on conflict (key) do nothing;

commit;
