-- Mama's imported entries no longer name the channel the lines came from: the Source title and the Folk texts'
-- provenance notes say "razgovor", not "WhatsApp". Forward-only rewrite of the rows seeded by
-- 20261118000000_seed_mamine_poruke.sql; replay-safe (a second run matches nothing) and limited to the
-- Source 'source:iz-mamine-poruke' and the Folk texts linked to it. Later editor edits to other text are kept.
begin;
set local app.actor = 'import';

update public.sources
set title = 'Razgovor s Mamom, 10.–17. studenoga 2026.'
where id = public.content_uuid('source:iz-mamine-poruke')
  and title = 'WhatsApp razgovor s Mamom, 10.–17. studenoga 2026.';

update public.folk_texts as ft
set research_notes = replace(ft.research_notes, 'iz WhatsApp izvoza s Mamom', 'iz razgovora s Mamom')
where ft.research_notes like '%iz WhatsApp izvoza s Mamom%'
  and exists (
    select 1 from public.folk_text_sources fts
    where fts.folk_text_id = ft.id
      and fts.source_id = public.content_uuid('source:iz-mamine-poruke')
  );

commit;
