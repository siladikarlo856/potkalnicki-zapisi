-- Challenge templates: the fixed challenge sets ("Izazov zavičaja") move from content/heritage/challenge.json
-- into the database, so the admin edits them (/admin/izazovi) and new challenges use the change at once.
--
-- * heritage_challenge_templates follows the content-table conventions of 20261103010000_content_tables.sql:
--   UUID id, status draft | published | archived, a database-managed revision, created_at/updated_at,
--   accent-folded search_text (from the name) and full history in content_revisions (entity_kind
--   'challenge_template'). RLS on and server-only, like every other table.
-- * content is the challenge set in the shape of heritage_challenges.content without "version": a new fixed
--   challenge copies the current template's content and takes its version from the template revision (and
--   templateId from its id). The app validates the full shape (shared/utils/content/challengeTemplate.ts);
--   the checks here keep the outline and the size.
-- * At most one template is current, and it is published. Making a template current demotes the previous
--   one in the same statement. The current template cannot be switched off, unpublished, archived or deleted,
--   so new challenges always have one; set another template current first. These refusals are written for
--   the admin screen, which shows a trigger's message as it is.
-- * The sample set from content/heritage/challenge.json is seeded as the current template, with actor
--   'import' in its history. test/challengeTemplates.test.ts keeps the seed equal to that file.
--
-- Additive: the running app still reads content/heritage/challenge.json and ignores the table, so migrating
-- first is safe, and an app rollback keeps the table. Existing challenges keep their own snapshots.
begin;

create table public.heritage_challenge_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  content jsonb not null constraint heritage_challenge_templates_content_shape check (
    jsonb_typeof(content) = 'object'
    and jsonb_typeof(content->'sample') = 'boolean'
    and jsonb_typeof(content->'title') = 'object'
    and jsonb_typeof(content->'rounds') = 'array'
    and jsonb_array_length(content->'rounds') between 1 and 10
    and not content ?| array['version', 'templateId']
    and octet_length(content::text) <= 262144),
  is_current boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  revision integer not null default 1 check (revision > 0),
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint heritage_challenge_templates_current_published check (not is_current or status = 'published')
);
comment on table public.heritage_challenge_templates is
  'Fixed challenge sets. The current one is copied into every new fixed challenge (heritage_challenges.content).';
comment on column public.heritage_challenge_templates.content is
  'The challenge set without version; a snapshot takes version from revision and templateId from id.';
comment on column public.heritage_challenge_templates.is_current is
  'The template new fixed challenges are created from: at most one, always published.';
create unique index heritage_challenge_templates_current on public.heritage_challenge_templates (is_current) where is_current;

-- BEFORE INSERT OR UPDATE OR DELETE: the "current" rules. Runs after heritage_challenge_templates_before_write
-- (triggers of the same timing fire in name order), which has already applied the generic conventions.
create function public.heritage_challenge_templates_current_rules() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.is_current then
      raise exception 'Trenutni izazov ne može se obrisati. Najprije postavi drugi izazov kao trenutni.';
    end if;
    return old;
  end if;
  -- Switching off is allowed only while another template becomes current (the update below).
  if tg_op = 'UPDATE' and old.is_current and not new.is_current
    and coalesce(current_setting('app.challenge_template_switch', true), '') = '' then
    raise exception 'Trenutni izazov ostaje trenutni dok drugi izazov ne postaviš kao trenutni.';
  end if;
  if new.is_current and new.status <> 'published' then
    raise exception 'Trenutni izazov mora ostati objavljen. Najprije postavi drugi izazov kao trenutni.';
  end if;
  if new.is_current and (tg_op = 'INSERT' or not old.is_current) then
    -- Demote the previous current template before this row is written, so the unique index never sees two.
    perform set_config('app.challenge_template_switch', new.id::text, true);
    update public.heritage_challenge_templates set is_current = false where is_current and id <> new.id;
    perform set_config('app.challenge_template_switch', '', true);
  end if;
  return new;
end;
$$;

create trigger heritage_challenge_templates_before_write before insert or update on public.heritage_challenge_templates
  for each row execute function public.content_before_write('name');
create trigger heritage_challenge_templates_current_rules before insert or update or delete on public.heritage_challenge_templates
  for each row execute function public.heritage_challenge_templates_current_rules();
create trigger heritage_challenge_templates_audit after insert or update or delete on public.heritage_challenge_templates
  for each row execute function public.content_audit('challenge_template');

-- Server-only access, like every other table: RLS on, no public grants, service_role only.
alter table public.heritage_challenge_templates enable row level security;
revoke all privileges on table public.heritage_challenge_templates from public, anon, authenticated;
grant all privileges on table public.heritage_challenge_templates to service_role;
-- Trigger functions need no EXECUTE to fire.
revoke all on function public.heritage_challenge_templates_current_rules() from public, anon, authenticated;

-- The sample set as the current template (unless one is current already). Its id is
-- content_uuid('challenge_template:sample') in every environment. The row is inserted only when it is missing,
-- rather than with on conflict do nothing: BEFORE INSERT triggers fire before a conflict is detected, so a
-- replay would otherwise demote whichever template is current. A replay therefore changes nothing.
set local app.actor = 'import';
insert into public.heritage_challenge_templates (id, name, content, is_current, status)
select public.content_uuid('challenge_template:sample'), 'Izazov zavičaja — uzorak', $challenge$
{
  "sample": true,
  "title": {
    "hr": "Izazov zavičaja — uzorak",
    "en": "Heritage challenge — sample"
  },
  "rounds": [
    {
      "id": "words",
      "topic": {
        "hr": "Riječi — uzorak",
        "en": "Words — sample"
      },
      "questions": [
        {
          "id": "word-1",
          "mechanic": "multiple-choice",
          "prompt": {
            "hr": "Uzorak riječi: što znači „hiža” u ovom primjeru?",
            "en": "Sample word: what does “hiža” mean in this example?"
          },
          "options": [
            {
              "hr": "kuća",
              "en": "house"
            },
            {
              "hr": "što",
              "en": "what"
            },
            {
              "hr": "sat",
              "en": "clock"
            },
            {
              "hr": "bunar",
              "en": "well"
            }
          ],
          "correct": 0,
          "explanation": {
            "hr": "U ovom uzorku „hiža” znači „kuća”. Lokalna uporaba još nije provjerena.",
            "en": "In this sample, “hiža” means “house”. Local usage has not been verified."
          }
        },
        {
          "id": "word-2",
          "mechanic": "multiple-choice",
          "prompt": {
            "hr": "Uzorak riječi: što znači „kaj” u ovom primjeru?",
            "en": "Sample word: what does “kaj” mean in this example?"
          },
          "options": [
            {
              "hr": "kuća",
              "en": "house"
            },
            {
              "hr": "što",
              "en": "what"
            },
            {
              "hr": "sat",
              "en": "clock"
            },
            {
              "hr": "bunar",
              "en": "well"
            }
          ],
          "correct": 1,
          "explanation": {
            "hr": "U ovom uzorku „kaj” znači „što”. Lokalna uporaba još nije provjerena.",
            "en": "In this sample, “kaj” means “what”. Local usage has not been verified."
          }
        },
        {
          "id": "word-3",
          "mechanic": "multiple-choice",
          "prompt": {
            "hr": "Uzorak riječi: što znači „vura” u ovom primjeru?",
            "en": "Sample word: what does “vura” mean in this example?"
          },
          "options": [
            {
              "hr": "kuća",
              "en": "house"
            },
            {
              "hr": "što",
              "en": "what"
            },
            {
              "hr": "sat",
              "en": "clock"
            },
            {
              "hr": "bunar",
              "en": "well"
            }
          ],
          "correct": 2,
          "explanation": {
            "hr": "U ovom uzorku „vura” znači „sat”. Lokalna uporaba još nije provjerena.",
            "en": "In this sample, “vura” means “clock”. Local usage has not been verified."
          }
        },
        {
          "id": "word-4",
          "mechanic": "multiple-choice",
          "prompt": {
            "hr": "Uzorak riječi: što znači „zdenec” u ovom primjeru?",
            "en": "Sample word: what does “zdenec” mean in this example?"
          },
          "options": [
            {
              "hr": "kuća",
              "en": "house"
            },
            {
              "hr": "što",
              "en": "what"
            },
            {
              "hr": "sat",
              "en": "clock"
            },
            {
              "hr": "bunar",
              "en": "well"
            }
          ],
          "correct": 3,
          "explanation": {
            "hr": "U ovom uzorku „zdenec” znači „bunar”. Lokalna uporaba još nije provjerena.",
            "en": "In this sample, “zdenec” means “well”. Local usage has not been verified."
          }
        },
        {
          "id": "word-5",
          "mechanic": "multiple-choice",
          "prompt": {
            "hr": "Uzorak riječi: što znači „fertun” u ovom primjeru?",
            "en": "Sample word: what does “fertun” mean in this example?"
          },
          "options": [
            {
              "hr": "pregača",
              "en": "apron"
            },
            {
              "hr": "kuća",
              "en": "house"
            },
            {
              "hr": "što",
              "en": "what"
            },
            {
              "hr": "sat",
              "en": "clock"
            }
          ],
          "correct": 0,
          "explanation": {
            "hr": "U ovom uzorku „fertun” znači „pregača”. Lokalna uporaba još nije provjerena.",
            "en": "In this sample, “fertun” means “apron”. Local usage has not been verified."
          }
        }
      ]
    },
    {
      "id": "landmarks",
      "topic": {
        "hr": "Znamenitosti — izmišljeni primjeri",
        "en": "Landmarks — fictional examples"
      },
      "questions": [
        {
          "id": "landmark-1",
          "mechanic": "multiple-choice",
          "prompt": {
            "hr": "Na izmišljenoj karti uzorak označava most plavim krugom. Koja oznaka predstavlja most?",
            "en": "On a fictional sample map, a bridge is marked with a blue circle. Which symbol represents the bridge?"
          },
          "options": [
            {
              "hr": "Plavi krug",
              "en": "Blue circle"
            },
            {
              "hr": "Crveni kvadrat",
              "en": "Red square"
            },
            {
              "hr": "Žuti trokut",
              "en": "Yellow triangle"
            },
            {
              "hr": "Zelena zvijezda",
              "en": "Green star"
            }
          ],
          "correct": 0,
          "explanation": {
            "hr": "Oznake na karti pomažu povezati simbole i mjesta. Ovaj most i karta su izmišljeni.",
            "en": "Map keys connect symbols with places. This bridge and map are fictional."
          }
        },
        {
          "id": "landmark-2",
          "mechanic": "multiple-choice",
          "prompt": {
            "hr": "Izmišljeni putokaz kaže: „Mlin — lijevo, toranj — desno”. Kamo ideš prema mlinu?",
            "en": "A fictional sign says: “Mill — left, tower — right”. Which way is the mill?"
          },
          "options": [
            {
              "hr": "Desno",
              "en": "Right"
            },
            {
              "hr": "Lijevo",
              "en": "Left"
            },
            {
              "hr": "Ravno",
              "en": "Straight"
            },
            {
              "hr": "Natrag",
              "en": "Back"
            }
          ],
          "correct": 1,
          "explanation": {
            "hr": "U ovom izmišljenom primjeru putokaz vodi lijevo prema mlinu.",
            "en": "In this fictional example the sign points left to the mill."
          }
        },
        {
          "id": "landmark-3",
          "mechanic": "multiple-choice",
          "prompt": {
            "hr": "Na izmišljenoj fotografiji piše „Drveni most”. Koji materijal navodi natpis?",
            "en": "A fictional photograph is captioned “Wooden bridge”. What material does it name?"
          },
          "options": [
            {
              "hr": "Kamen",
              "en": "Stone"
            },
            {
              "hr": "Metal",
              "en": "Metal"
            },
            {
              "hr": "Drvo",
              "en": "Wood"
            },
            {
              "hr": "Staklo",
              "en": "Glass"
            }
          ],
          "correct": 2,
          "explanation": {
            "hr": "Natpis daje odgovor: drvo. Ovo nije opis stvarnog lokalnog mosta.",
            "en": "The caption gives the answer: wood. This is not a description of a real local bridge."
          }
        },
        {
          "id": "landmark-4",
          "mechanic": "multiple-choice",
          "prompt": {
            "hr": "Uzorak legende: zvijezda znači vidikovac. Što označava zvijezda?",
            "en": "Sample map key: a star means a viewpoint. What does a star mark?"
          },
          "options": [
            {
              "hr": "Bunar",
              "en": "Well"
            },
            {
              "hr": "Školu",
              "en": "School"
            },
            {
              "hr": "Mlin",
              "en": "Mill"
            },
            {
              "hr": "Vidikovac",
              "en": "Viewpoint"
            }
          ],
          "correct": 3,
          "explanation": {
            "hr": "Legenda objašnjava oznake samo na ovoj izmišljenoj karti.",
            "en": "This key explains symbols only on this fictional map."
          }
        },
        {
          "id": "landmark-5",
          "mechanic": "multiple-choice",
          "prompt": {
            "hr": "U izmišljenom dnevniku šetnje prvo je trg, zatim park. Što dolazi nakon trga?",
            "en": "In a fictional walk diary the square comes first, then the park. What follows the square?"
          },
          "options": [
            {
              "hr": "Park",
              "en": "Park"
            },
            {
              "hr": "Toranj",
              "en": "Tower"
            },
            {
              "hr": "Stanica",
              "en": "Station"
            },
            {
              "hr": "Most",
              "en": "Bridge"
            }
          ],
          "correct": 0,
          "explanation": {
            "hr": "Uzorak dnevnika navodi park nakon trga; ne opisuje stvarnu rutu.",
            "en": "The sample diary places the park after the square; this is not a real route."
          }
        }
      ]
    },
    {
      "id": "villages",
      "topic": {
        "hr": "Sela i priče — izmišljeni primjeri",
        "en": "Villages and stories — fictional examples"
      },
      "questions": [
        {
          "id": "village-1",
          "mechanic": "multiple-choice",
          "prompt": {
            "hr": "Izmišljeno selo A ima knjižnicu, selo B ima igralište. Gdje je knjižnica?",
            "en": "Fictional village A has a library; village B has a playground. Where is the library?"
          },
          "options": [
            {
              "hr": "Selo B",
              "en": "Village B"
            },
            {
              "hr": "Selo A",
              "en": "Village A"
            },
            {
              "hr": "U oba sela",
              "en": "Both villages"
            },
            {
              "hr": "Nije navedeno",
              "en": "Not stated"
            }
          ],
          "correct": 1,
          "explanation": {
            "hr": "Ovo su izmišljena sela. U opisu je knjižnica u selu A.",
            "en": "These villages are fictional. The description places the library in village A."
          }
        },
        {
          "id": "village-2",
          "mechanic": "multiple-choice",
          "prompt": {
            "hr": "U izmišljenoj priči Ana bilježi stare riječi. Što Ana prikuplja?",
            "en": "In a fictional story Ana records old words. What does Ana collect?"
          },
          "options": [
            {
              "hr": "Marke",
              "en": "Stamps"
            },
            {
              "hr": "Recepte",
              "en": "Recipes"
            },
            {
              "hr": "Riječi",
              "en": "Words"
            },
            {
              "hr": "Kamenje",
              "en": "Stones"
            }
          ],
          "correct": 2,
          "explanation": {
            "hr": "Ana je izmišljeni lik u ovom uzorku, a njezina zbirka sadrži riječi.",
            "en": "Ana is a fictional character in this sample, and her collection contains words."
          }
        },
        {
          "id": "village-3",
          "mechanic": "multiple-choice",
          "prompt": {
            "hr": "Uzorak programa izmišljenog sela: u subotu šetnja, u nedjelju izložba. Kada je izložba?",
            "en": "Sample programme for a fictional village: walk on Saturday, exhibition on Sunday. When is the exhibition?"
          },
          "options": [
            {
              "hr": "U petak",
              "en": "Friday"
            },
            {
              "hr": "U subotu",
              "en": "Saturday"
            },
            {
              "hr": "U ponedjeljak",
              "en": "Monday"
            },
            {
              "hr": "U nedjelju",
              "en": "Sunday"
            }
          ],
          "correct": 3,
          "explanation": {
            "hr": "Ovo nije najava stvarnog događaja. Uzorak navodi nedjelju.",
            "en": "This is not a real event listing. The sample names Sunday."
          }
        },
        {
          "id": "village-4",
          "mechanic": "multiple-choice",
          "prompt": {
            "hr": "Izmišljena zbirka ima tri fotografije i jednu razglednicu. Koliko je razglednica?",
            "en": "A fictional collection has three photographs and one postcard. How many postcards are there?"
          },
          "options": [
            {
              "hr": "Jedna",
              "en": "One"
            },
            {
              "hr": "Dvije",
              "en": "Two"
            },
            {
              "hr": "Tri",
              "en": "Three"
            },
            {
              "hr": "Četiri",
              "en": "Four"
            }
          ],
          "correct": 0,
          "explanation": {
            "hr": "Uzorak razlikuje fotografije od razglednice; u zbirci je jedna razglednica.",
            "en": "The sample distinguishes photographs from postcards; it contains one postcard."
          }
        },
        {
          "id": "village-5",
          "mechanic": "multiple-choice",
          "prompt": {
            "hr": "U izmišljenoj priči Marko zapisuje tko mu je ispričao uspomenu. Što bilježi?",
            "en": "In a fictional story Marko writes down who shared a memory with him. What does he record?"
          },
          "options": [
            {
              "hr": "Rezultat utrke",
              "en": "Race result"
            },
            {
              "hr": "Izvor uspomene",
              "en": "Source of the memory"
            },
            {
              "hr": "Vozni red",
              "en": "Timetable"
            },
            {
              "hr": "Temperaturu",
              "en": "Temperature"
            }
          ],
          "correct": 1,
          "explanation": {
            "hr": "Bilježenje izvora pomaže sačuvati kontekst priče. Marko i uspomena su izmišljeni.",
            "en": "Recording a source helps preserve a story’s context. Marko and the memory are fictional."
          }
        }
      ]
    }
  ]
}
$challenge$::jsonb,
  not exists (select 1 from public.heritage_challenge_templates where is_current), 'published'
where not exists (select 1 from public.heritage_challenge_templates where id = public.content_uuid('challenge_template:sample'));

commit;
