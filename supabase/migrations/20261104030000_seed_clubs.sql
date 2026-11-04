-- Seed clubs from ksh-clubs-research (WP20). Replay-safe: on conflict do nothing.
begin;
set local app.actor = 'import';

insert into public.sources (id, title, type, url, status) values ('339e64a1-d8b7-8fef-695a-9dd48435b7c4', 'hr.wikipedia.org', 'website', 'https://hr.wikipedia.org/wiki/NK_Kalnik', 'published') on conflict (id) do nothing;
insert into public.sources (id, title, type, url, status) values ('68b4c0f7-0069-8ddc-4322-de110bc6c18e', 'hr.wikipedia.org', 'website', 'https://hr.wikipedia.org/wiki/Sveti_Petar_Orehovec', 'published') on conflict (id) do nothing;
insert into public.sources (id, title, type, url, status) values ('c3197df7-80bd-8e9e-66e8-c3a85447cc86', 'kazu.com.hr', 'website', 'https://kazu.com.hr/udruge/mjesto/kalnik', 'published') on conflict (id) do nothing;
insert into public.sources (id, title, type, url, status) values ('3e27dd5b-6274-877d-52b1-6941bfa09045', 'krizevci.hr', 'website', 'https://krizevci.hr/adresar/', 'published') on conflict (id) do nothing;
insert into public.sources (id, title, type, url, status) values ('bee356d4-b7cb-8a81-5bc6-67cffeaa9f7a', 'krizevci.hr', 'website', 'https://krizevci.hr/adresar/nogometni-klub-krizevci-krizevci/', 'published') on conflict (id) do nothing;
insert into public.sources (id, title, type, url, status) values ('a8691e3a-c4a4-8f26-752d-a06173a492af', 'semafor.hns.family', 'website', 'https://semafor.hns.family/klubovi/179252/nk-tomislav-siz/', 'published') on conflict (id) do nothing;
insert into public.sources (id, title, type, url, status) values ('7781eae6-9827-87cf-675e-99ee4abcae5b', 'semafor.hns.family', 'website', 'https://semafor.hns.family/klubovi/5725/kalnik/', 'published') on conflict (id) do nothing;
insert into public.sources (id, title, type, url, status) values ('1ce96079-ac2e-8e4b-64e2-7ff1a1b2653b', 'semafor.hns.family', 'website', 'https://semafor.hns.family/klubovi/918/nk-radnik-krizevci/', 'published') on conflict (id) do nothing;
insert into public.sources (id, title, type, url, status) values ('35e1fb1d-7f1c-8b52-4465-48f05f3ed78c', 'semafor.hns.family', 'website', 'https://semafor.hns.family/klubovi/923/nk-tomislav-radnik/', 'published') on conflict (id) do nothing;
insert into public.sources (id, title, type, url, status) values ('be949770-a591-81e2-58c4-30482a0e2611', 'semafor.hns.family', 'website', 'https://semafor.hns.family/klubovi/941/nk-polet/', 'published') on conflict (id) do nothing;
insert into public.sources (id, title, type, url, status) values ('9d852528-2796-8051-724d-e21b5255850d', 'semafor.hns.family', 'website', 'https://semafor.hns.family/klubovi/943/nk-dragovoljac/', 'published') on conflict (id) do nothing;
insert into public.sources (id, title, type, url, status) values ('05ec53ce-2706-8ae2-5791-0d1f8aaf1b21', 'semafor.hns.family', 'website', 'https://semafor.hns.family/klubovi/945/nk-ratar/', 'published') on conflict (id) do nothing;
insert into public.sources (id, title, type, url, status) values ('6a13dcd7-f061-8e4c-48c5-f7e3bf1d46dd', 'semafor.hns.family', 'website', 'https://semafor.hns.family/klubovi/952/nk-gornja-rijeka/', 'published') on conflict (id) do nothing;
insert into public.sources (id, title, type, url, status) values ('9402323b-b52f-87a0-487e-abd47b9ebb1e', 'semafor.hns.family', 'website', 'https://semafor.hns.family/klubovi/957/nk-mladost-carevdar/', 'published') on conflict (id) do nothing;
insert into public.sources (id, title, type, url, status) values ('5127e547-2ba6-8618-5bd8-d6f686732d90', 'semafor.hns.family', 'website', 'https://semafor.hns.family/klubovi/961/nk-prigorje/', 'published') on conflict (id) do nothing;
insert into public.sources (id, title, type, url, status) values ('13f71c4e-fbbd-868b-7539-e0fdda07a66d', 'semafor.hns.family', 'website', 'https://semafor.hns.family/klubovi/966/nk-hrvatski-bojovnik/', 'published') on conflict (id) do nothing;
insert into public.sources (id, title, type, url, status) values ('7b69f8c3-e40d-8031-4bb9-ceb0de029c90', 'semafor.hns.family', 'website', 'https://semafor.hns.family/klubovi/967/nk-radnicki/', 'published') on conflict (id) do nothing;
insert into public.sources (id, title, type, url, status) values ('e48f75ad-f397-8faa-7795-e6cb4c5eb87c', 'semafor.hns.family', 'website', 'https://semafor.hns.family/klubovi/969/nk-mladost-veliki-raven/', 'published') on conflict (id) do nothing;
insert into public.sources (id, title, type, url, status) values ('6f2a1c93-a60c-8419-5b1a-6df8af0bb447', 'www.companywall.hr', 'website', 'https://www.companywall.hr/tvrtka/nk-kalnik/MMIJwiKD', 'published') on conflict (id) do nothing;

-- NK Radnik Križevci
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  '86974bf5-7ab2-8892-509e-8ca6322c13ee',
  'NK Radnik Križevci',
  'nk-radnik-krizevci',
  'Nogometni klub "Radnik" Križevci',
  'nogomet',
  (select id from public.areas where kind = 'settlement' and slug = 'krizevci'),
  1909,
  'Gradski stadion',
  'Atlas parent for settlement Križevci is town grad-krizevci (seed).',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('86974bf5-7ab2-8892-509e-8ca6322c13ee', '1ce96079-ac2e-8e4b-64e2-7ff1a1b2653b', 0) on conflict do nothing;
insert into public.club_sources (club_id, source_id, position) values ('86974bf5-7ab2-8892-509e-8ca6322c13ee', 'bee356d4-b7cb-8a81-5bc6-67cffeaa9f7a', 1) on conflict do nothing;
insert into public.club_seasons (id, club_id, season, competition, team, source_url, checked_at) values (
  'd82701a4-41c3-814e-5c15-2e14b0beec9c', '86974bf5-7ab2-8892-509e-8ca6322c13ee', '2026/27', 'SuperSport Druga NL', 'seniori', 'https://semafor.hns.family/klubovi/918/nk-radnik-krizevci/', '2026-11-04'::date
) on conflict (club_id, season, team) do nothing;
insert into public.club_seasons (id, club_id, season, competition, team, source_url, checked_at) values (
  'efcd91cb-561c-88e7-6d43-bc2c6c3779dc', '86974bf5-7ab2-8892-509e-8ca6322c13ee', '2026/27', 'Veterani I ŽNL-a', 'veterani', 'https://semafor.hns.family/natjecanja/115120841/veterani-i-znl-a/', '2026-11-04'::date
) on conflict (club_id, season, team) do nothing;

-- NK Radnički
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  '8b26f335-7c67-8844-47d6-2984b4ba5e19',
  'NK Radnički',
  'nk-radnicki',
  null,
  'nogomet',
  (select id from public.areas where kind = 'settlement' and slug = 'krizevci'),
  null,
  'Križevci (stadion na adresi Radnički dol 29)',
  'full_name not on Semafor club page; founding year not verified',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('8b26f335-7c67-8844-47d6-2984b4ba5e19', '7b69f8c3-e40d-8031-4bb9-ceb0de029c90', 0) on conflict do nothing;
insert into public.club_seasons (id, club_id, season, competition, team, source_url, checked_at) values (
  '991e56a7-a477-8685-53b3-66038fac94f9', '8b26f335-7c67-8844-47d6-2984b4ba5e19', '2026/27', 'III ŽNL-a', 'seniori', 'https://semafor.hns.family/natjecanja/114788098/iii-znl-a/', '2026-11-04'::date
) on conflict (club_id, season, team) do nothing;

-- NK Viktorija Vojakovac
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  '9322859e-55bc-8687-5c51-e2edf876ba39',
  'NK Viktorija Vojakovac',
  'nk-viktorija-vojakovac',
  null,
  'nogomet',
  (select id from public.areas where kind = 'settlement' and slug = 'vojakovac'),
  null,
  null,
  '2026/27 competition not verified on HNS Semafor; home ground not verified',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('9322859e-55bc-8687-5c51-e2edf876ba39', '3e27dd5b-6274-877d-52b1-6941bfa09045', 0) on conflict do nothing;

-- NK Prigorje
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  'b41766d9-9489-82a8-552c-6bc0539fd269',
  'NK Prigorje',
  'nk-prigorje',
  'Nogometni klub Prigorje Sveti Petar Orehovec',
  'nogomet',
  (select id from public.areas where kind = 'settlement' and slug = 'sveti-petar-orehovec'),
  null,
  'Sveti Petar Orehovec',
  'founding year not on Semafor',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('b41766d9-9489-82a8-552c-6bc0539fd269', '5127e547-2ba6-8618-5bd8-d6f686732d90', 0) on conflict do nothing;
insert into public.club_sources (club_id, source_id, position) values ('b41766d9-9489-82a8-552c-6bc0539fd269', '68b4c0f7-0069-8ddc-4322-de110bc6c18e', 1) on conflict do nothing;
insert into public.club_seasons (id, club_id, season, competition, team, source_url, checked_at) values (
  'd5f911b7-1687-82b3-6c22-b67503e7de1b', 'b41766d9-9489-82a8-552c-6bc0539fd269', '2026/27', 'III ŽNL-a', 'seniori', 'https://semafor.hns.family/natjecanja/114788098/iii-znl-a/', '2026-11-04'::date
) on conflict (club_id, season, team) do nothing;

-- NK Dragovoljac
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  '8a1d1c0b-442d-8d4c-4d37-822c395b281f',
  'NK Dragovoljac',
  'nk-dragovoljac-bockovec',
  null,
  'nogomet',
  (select id from public.areas where kind = 'settlement' and slug = 'bockovec'),
  null,
  'Bočkovec',
  'founding year not verified; distinct from NK Dragovoljac Poličnik (Zadar) on Semafor id 209',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('8a1d1c0b-442d-8d4c-4d37-822c395b281f', '9d852528-2796-8051-724d-e21b5255850d', 0) on conflict do nothing;
insert into public.club_seasons (id, club_id, season, competition, team, source_url, checked_at) values (
  '0988aca1-2d9b-88ab-40e6-8c65b6db4b37', '8a1d1c0b-442d-8d4c-4d37-822c395b281f', '2026/27', 'III ŽNL-a', 'seniori', 'https://semafor.hns.family/natjecanja/114788098/iii-znl-a/', '2026-11-04'::date
) on conflict (club_id, season, team) do nothing;

-- NK Ratar
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  '7cf45cfb-f919-8076-7071-985fe0e23d4c',
  'NK Ratar',
  'nk-ratar',
  null,
  'nogomet',
  (select id from public.areas where kind = 'settlement' and slug = 'miholec'),
  null,
  'Miholec',
  'some home matches listed at Sveti Petar Orehovec on Semafor fixtures — venue varies',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('7cf45cfb-f919-8076-7071-985fe0e23d4c', '05ec53ce-2706-8ae2-5791-0d1f8aaf1b21', 0) on conflict do nothing;
insert into public.club_seasons (id, club_id, season, competition, team, source_url, checked_at) values (
  '4e464680-08d6-8812-633d-646043dadb9c', '7cf45cfb-f919-8076-7071-985fe0e23d4c', '2026/27', 'II ŽNL-a', 'seniori', 'https://semafor.hns.family/natjecanja/114769393/ii-znl-a/', '2026-11-04'::date
) on conflict (club_id, season, team) do nothing;

-- NK Hrvatski Bojovnik
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  '9dc5e015-8b14-8275-5d3b-81660574fc1c',
  'NK Hrvatski Bojovnik',
  'nk-hrvatski-bojovnik',
  null,
  'nogomet',
  (select id from public.areas where kind = 'settlement' and slug = 'mokrice-miholecke'),
  null,
  'Hrvatski Bojovnik',
  'founding year not verified',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('9dc5e015-8b14-8275-5d3b-81660574fc1c', '13f71c4e-fbbd-868b-7539-e0fdda07a66d', 0) on conflict do nothing;
insert into public.club_seasons (id, club_id, season, competition, team, source_url, checked_at) values (
  'ebf43a3c-3b09-837b-44f9-2bd0b3af8cdf', '9dc5e015-8b14-8275-5d3b-81660574fc1c', '2026/27', 'II ŽNL-a', 'seniori', 'https://semafor.hns.family/natjecanja/114769393/ii-znl-a/', '2026-11-04'::date
) on conflict (club_id, season, team) do nothing;

-- NK Mladost Carevdar
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  '9c2ef968-fb42-8d75-7c8e-17a005cb29d5',
  'NK Mladost Carevdar',
  'nk-mladost-carevdar',
  null,
  'nogomet',
  (select id from public.areas where kind = 'settlement' and slug = 'carevdar'),
  null,
  'Carevdar',
  'Atlas maps Carevdar under town grad-krizevci, not općina Sveti Petar Orehovec (seed quirk)',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('9c2ef968-fb42-8d75-7c8e-17a005cb29d5', '9402323b-b52f-87a0-487e-abd47b9ebb1e', 0) on conflict do nothing;
insert into public.club_seasons (id, club_id, season, competition, team, source_url, checked_at) values (
  '66800182-3661-8524-5896-f87973ffa77c', '9c2ef968-fb42-8d75-7c8e-17a005cb29d5', '2026/27', 'III ŽNL-a', 'seniori', 'https://semafor.hns.family/natjecanja/114788098/iii-znl-a/', '2026-11-04'::date
) on conflict (club_id, season, team) do nothing;

-- NK Mladost Veliki Raven
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  'be3789f5-1e59-8e4f-66ff-8a3554f529d7',
  'NK Mladost Veliki Raven',
  'nk-mladost-veliki-raven',
  null,
  'nogomet',
  (select id from public.areas where kind = 'settlement' and slug = 'veliki-raven'),
  null,
  'Veliki Raven',
  'Atlas maps Veliki Raven under town grad-krizevci (seed)',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('be3789f5-1e59-8e4f-66ff-8a3554f529d7', 'e48f75ad-f397-8faa-7795-e6cb4c5eb87c', 0) on conflict do nothing;
insert into public.club_seasons (id, club_id, season, competition, team, source_url, checked_at) values (
  'ff4e61d9-6e39-84a3-5a45-226daebbc3af', 'be3789f5-1e59-8e4f-66ff-8a3554f529d7', '2026/27', 'III ŽNL-a', 'seniori', 'https://semafor.hns.family/natjecanja/114788098/iii-znl-a/', '2026-11-04'::date
) on conflict (club_id, season, team) do nothing;

-- NK Polet
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  '9c3d023f-20f5-8574-6458-9b3a0ad0c7e8',
  'NK Polet',
  'nk-polet-glogovnica',
  null,
  'nogomet',
  (select id from public.areas where kind = 'settlement' and slug = 'donja-glogovnica'),
  null,
  'Glogovnica',
  'Semafor label ''Glogovnica'' matched to atlas slug donja-glogovnica',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('9c3d023f-20f5-8574-6458-9b3a0ad0c7e8', 'be949770-a591-81e2-58c4-30482a0e2611', 0) on conflict do nothing;
insert into public.club_seasons (id, club_id, season, competition, team, source_url, checked_at) values (
  '385cfc1e-02c9-8736-5bed-b18208d3334a', '9c3d023f-20f5-8574-6458-9b3a0ad0c7e8', '2026/27', 'III ŽNL-a', 'seniori', 'https://semafor.hns.family/natjecanja/114788098/iii-znl-a/', '2026-11-04'::date
) on conflict (club_id, season, team) do nothing;

-- NK Gornja Rijeka
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  '9684b6a3-1310-8c18-6b63-cb689690c0ed',
  'NK Gornja Rijeka',
  'nk-gornja-rijeka',
  null,
  'nogomet',
  (select id from public.areas where kind = 'settlement' and slug = 'gornja-rijeka'),
  null,
  'Gornja Rijeka',
  'founding year not verified',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('9684b6a3-1310-8c18-6b63-cb689690c0ed', '6a13dcd7-f061-8e4c-48c5-f7e3bf1d46dd', 0) on conflict do nothing;
insert into public.club_seasons (id, club_id, season, competition, team, source_url, checked_at) values (
  'ca2a344b-d82e-8d41-7ed4-a0374d6923b2', '9684b6a3-1310-8c18-6b63-cb689690c0ed', '2026/27', 'II ŽNL-a', 'seniori', 'https://semafor.hns.family/natjecanja/114769393/ii-znl-a/', '2026-11-04'::date
) on conflict (club_id, season, team) do nothing;

-- NK Tomislav SIŽ
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  '786ad597-6e01-87a0-669b-dd9d2a5af348',
  'NK Tomislav SIŽ',
  'nk-tomislav-siz',
  null,
  'nogomet',
  (select id from public.areas where kind = 'settlement' and slug = 'sveti-ivan-zabno'),
  2025,
  'Sveti Ivan Žabno',
  'founding date on Semafor may be re-registration, not club history',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('786ad597-6e01-87a0-669b-dd9d2a5af348', 'a8691e3a-c4a4-8f26-752d-a06173a492af', 0) on conflict do nothing;
insert into public.club_seasons (id, club_id, season, competition, team, source_url, checked_at) values (
  '75d8a1ab-7971-8580-7737-f4c759634a41', '786ad597-6e01-87a0-669b-dd9d2a5af348', '2026/27', 'II ŽNL-a', 'seniori', 'https://semafor.hns.family/natjecanja/114769393/ii-znl-a/', '2026-11-04'::date
) on conflict (club_id, season, team) do nothing;

-- NK Tomislav - Radnik
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  '414fde07-39d3-8e1d-6e28-a4d07477e32b',
  'NK Tomislav - Radnik',
  'nk-tomislav-radnik',
  null,
  'nogomet',
  (select id from public.areas where kind = 'settlement' and slug = 'sveti-ivan-zabno'),
  null,
  'Sveti Ivan Žabno',
  'founding year not verified; senior team in national 3rd league North group — separate from NK Tomislav SIŽ county league side',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('414fde07-39d3-8e1d-6e28-a4d07477e32b', '35e1fb1d-7f1c-8b52-4465-48f05f3ed78c', 0) on conflict do nothing;
insert into public.club_seasons (id, club_id, season, competition, team, source_url, checked_at) values (
  '422c3543-d2c2-8f23-7bdb-65e2a4a11c71', '414fde07-39d3-8e1d-6e28-a4d07477e32b', '2026/27', 'Treća NL Sjever 26/27', 'seniori', 'https://semafor.hns.family/klubovi/923/nk-tomislav-radnik/', '2026-11-04'::date
) on conflict (club_id, season, team) do nothing;

-- NK Kalnik
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  'a3ab243b-51fa-8a12-5adf-5c84bda80c44',
  'NK Kalnik',
  'nk-kalnik',
  'Nogometni klub "Kalnik"',
  'nogomet',
  (select id from public.areas where kind = 'settlement' and slug = 'kalnik'),
  2007,
  null,
  'NOT in HNS county league 2026/27 on Semafor; Semafor postal address still Vinarec (SPO) — conflicts with Companywall Kalnik HQ; planned return to competition reported Jan 2024 — not confirmed on Semafor',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('a3ab243b-51fa-8a12-5adf-5c84bda80c44', '7781eae6-9827-87cf-675e-99ee4abcae5b', 0) on conflict do nothing;
insert into public.club_sources (club_id, source_id, position) values ('a3ab243b-51fa-8a12-5adf-5c84bda80c44', '6f2a1c93-a60c-8419-5b1a-6df8af0bb447', 1) on conflict do nothing;
insert into public.club_sources (club_id, source_id, position) values ('a3ab243b-51fa-8a12-5adf-5c84bda80c44', '339e64a1-d8b7-8fef-695a-9dd48435b7c4', 2) on conflict do nothing;

-- Šahovski klub "Križevci"
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  '173e9bb5-51a2-8e32-7df5-8d5ddd2b00b0',
  'Šahovski klub "Križevci"',
  'sahovski-klub-krizevci',
  null,
  'šah',
  (select id from public.areas where kind = 'settlement' and slug = 'krizevci'),
  null,
  'Potočka ulica 26, Križevci',
  'league/competition 2026/27 not researched',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('173e9bb5-51a2-8e32-7df5-8d5ddd2b00b0', '3e27dd5b-6274-877d-52b1-6941bfa09045', 0) on conflict do nothing;

-- Boksački klub Ronin Križevci
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  'bc986cf5-d83b-8f64-47e6-c800b6eb3d1b',
  'Boksački klub Ronin Križevci',
  'bk-ronin-krizevci',
  null,
  'boks',
  (select id from public.areas where kind = 'settlement' and slug = 'krizevci'),
  null,
  'Frankopanska ul. 37, Križevci',
  'league/competition 2026/27 not researched',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('bc986cf5-d83b-8f64-47e6-c800b6eb3d1b', '3e27dd5b-6274-877d-52b1-6941bfa09045', 0) on conflict do nothing;

-- Akademski konjički klub Križevci
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  'bba5cb70-ebbc-87f6-7316-308fe4ec60f2',
  'Akademski konjički klub Križevci',
  'akc-krizevci',
  null,
  'konjički sport',
  (select id from public.areas where kind = 'settlement' and slug = 'krizevci'),
  null,
  'Ratarna 28, Križevci',
  'league/competition 2026/27 not researched',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('bba5cb70-ebbc-87f6-7316-308fe4ec60f2', '3e27dd5b-6274-877d-52b1-6941bfa09045', 0) on conflict do nothing;

-- Malonogometni klub Omladinac
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  'e4343611-3377-8fea-7505-04f199e016fb',
  'Malonogometni klub Omladinac',
  'mk-omladinac-popovec-kalnicki',
  'Malonogometni klub Omladinac',
  'nogomet na mali gol',
  (select id from public.areas where kind = 'settlement' and slug = 'popovec-kalnicki'),
  null,
  null,
  'active udruga per Kažu register only; 2026/27 competition not verified',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('e4343611-3377-8fea-7505-04f199e016fb', 'c3197df7-80bd-8e9e-66e8-c3a85447cc86', 0) on conflict do nothing;

-- Malonogometni klub Potok Kalnički
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  'ce5c010a-0d1b-8085-5aec-5de07d292da0',
  'Malonogometni klub Potok Kalnički',
  'mk-potok-kalnicki',
  'Malonogometni klub Potok Kalnički',
  'nogomet na mali gol',
  (select id from public.areas where kind = 'settlement' and slug = 'potok-kalnicki'),
  null,
  null,
  'active udruga per Kažu register only; 2026/27 competition not verified',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('ce5c010a-0d1b-8085-5aec-5de07d292da0', 'c3197df7-80bd-8e9e-66e8-c3a85447cc86', 0) on conflict do nothing;

-- Malonogometni klub Buldožeri
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  '1ddb3fe3-c086-8d5c-7ac0-d941ca2c7c93',
  'Malonogometni klub Buldožeri',
  'mk-buldozeri-vojnovec',
  'Malonogometni klub Buldožeri',
  'nogomet na mali gol',
  (select id from public.areas where kind = 'settlement' and slug = 'vojnovec-kalnicki'),
  null,
  null,
  'active udruga per Kažu register only; 2026/27 competition not verified',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('1ddb3fe3-c086-8d5c-7ac0-d941ca2c7c93', 'c3197df7-80bd-8e9e-66e8-c3a85447cc86', 0) on conflict do nothing;

-- Malonogometni klub Borje
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  'cdfcb4f9-394d-88bf-5bd0-8fe41a034544',
  'Malonogometni klub Borje',
  'mk-borje',
  'Malonogometni klub Borje',
  'nogomet na mali gol',
  (select id from public.areas where kind = 'settlement' and slug = 'borje'),
  null,
  null,
  'active udruga per Kažu register only; 2026/27 competition not verified',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('cdfcb4f9-394d-88bf-5bd0-8fe41a034544', 'c3197df7-80bd-8e9e-66e8-c3a85447cc86', 0) on conflict do nothing;

-- Malonogometni klub Kamešnica
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  '0f1697f5-bf7c-8c5a-453c-fb2061734c84',
  'Malonogometni klub Kamešnica',
  'mk-kamesnica',
  'Malonogometni klub Kamešnica',
  'nogomet na mali gol',
  (select id from public.areas where kind = 'settlement' and slug = 'kamesnica'),
  null,
  null,
  'active udruga per Kažu register only; 2026/27 competition not verified',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('0f1697f5-bf7c-8c5a-453c-fb2061734c84', 'c3197df7-80bd-8e9e-66e8-c3a85447cc86', 0) on conflict do nothing;

-- Malonogometni klub Kalnik 04
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  'c702393e-baad-8ecc-6850-443c4620aba8',
  'Malonogometni klub Kalnik 04',
  'mk-kalnik-04',
  'Malonogometni klub Kalnik 04',
  'nogomet na mali gol',
  (select id from public.areas where kind = 'settlement' and slug = 'kalnik'),
  null,
  null,
  'active udruga per Kažu register only; 2026/27 competition not verified',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('c702393e-baad-8ecc-6850-443c4620aba8', 'c3197df7-80bd-8e9e-66e8-c3a85447cc86', 0) on conflict do nothing;

-- Malonogometni klub Šopron
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  'e6652214-708a-801e-7db3-64b641c178a3',
  'Malonogometni klub Šopron',
  'mk-sopron',
  'Malonogometni klub Šopron',
  'nogomet na mali gol',
  (select id from public.areas where kind = 'settlement' and slug = 'sopron'),
  null,
  null,
  'active udruga per Kažu register only; 2026/27 competition not verified',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('e6652214-708a-801e-7db3-64b641c178a3', 'c3197df7-80bd-8e9e-66e8-c3a85447cc86', 0) on conflict do nothing;

-- Malonogometni klub Obrež Kalnički
insert into public.clubs (id, name, slug, full_name, sport, settlement_id, founded_year, home_ground, research_notes, verification, status) values (
  'c69408c9-d256-86ff-795b-538e1c155b5b',
  'Malonogometni klub Obrež Kalnički',
  'mk-obrez-kalnicki',
  'Malonogometni klub Obrež Kalnički',
  'nogomet na mali gol',
  (select id from public.areas where kind = 'settlement' and slug = 'obrez-kalnicki'),
  null,
  null,
  'active udruga per Kažu register only; 2026/27 competition not verified',
  'unverified', 'published'
) on conflict (id) do nothing;
insert into public.club_sources (club_id, source_id, position) values ('c69408c9-d256-86ff-795b-538e1c155b5b', 'c3197df7-80bd-8e9e-66e8-c3a85447cc86', 0) on conflict do nothing;

commit;
