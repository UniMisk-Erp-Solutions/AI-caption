-- Kinetic caption studio — initial schema.
--
-- Two rules shape everything here:
--
--   1. No media in Postgres. Videos live in R2; this database holds only the
--      project JSON, which is small, and the keys pointing at the blobs.
--   2. RLS on every table, with the same policy shape (`user_id = auth.uid()`).
--      Authorisation is never inferred from an id being hard to guess.

create extension if not exists "pgcrypto";

/* ------------------------------------------------------------------ */
/* profiles                                                            */
/* ------------------------------------------------------------------ */

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Create the profile row as part of signup rather than lazily on first write,
-- so nothing downstream has to handle a missing profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

/* ------------------------------------------------------------------ */
/* projects                                                            */
/* ------------------------------------------------------------------ */

create table if not exists public.projects (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  title             text not null default 'Untitled',
  status            text not null default 'draft'
                      check (status in ('draft','uploading','processing','ready','exporting','error')),

  width             integer not null default 1080,
  height            integer not null default 1920,
  fps               numeric not null default 30,
  duration_ms       integer not null default 0,

  -- The whole editable document: transcript, art direction, scenes, layers.
  -- Kept as one jsonb blob because it is always read and written as a unit and
  -- is orders of magnitude smaller than the media it describes.
  editor_state      jsonb,

  source_object_key text,
  thumbnail_key     text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists projects_user_updated_idx
  on public.projects (user_id, updated_at desc);

/* ------------------------------------------------------------------ */
/* assets                                                              */
/* ------------------------------------------------------------------ */

create table if not exists public.assets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,

  type        text not null check (type in ('source_video','thumbnail','export')),
  provider    text not null default 'r2',
  object_key  text not null,

  mime_type   text,
  size_bytes  bigint,
  duration_ms integer,
  metadata    jsonb not null default '{}'::jsonb,

  created_at  timestamptz not null default now()
);

create index if not exists assets_project_idx on public.assets (project_id);

/* ------------------------------------------------------------------ */
/* transcripts                                                         */
/* ------------------------------------------------------------------ */

create table if not exists public.transcripts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- One transcript per project, so the upsert in the client can rely on it.
  project_id   uuid not null unique references public.projects (id) on delete cascade,

  language     text not null default 'en',
  content_type text not null default 'unknown'
                 check (content_type in ('speech','song','mixed','instrumental','unknown')),

  full_text    text not null default '',
  words        jsonb not null default '[]'::jsonb,
  provider     text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

/* ------------------------------------------------------------------ */
/* exports                                                             */
/* ------------------------------------------------------------------ */

create table if not exists public.exports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,

  object_key text not null,
  width      integer not null,
  height     integer not null,
  fps        numeric not null,
  size_bytes bigint,
  status     text not null default 'complete'
               check (status in ('pending','complete','failed')),

  created_at timestamptz not null default now()
);

create index if not exists exports_project_idx on public.exports (project_id, created_at desc);

/* ------------------------------------------------------------------ */
/* usage_events                                                        */
/* ------------------------------------------------------------------ */

create table if not exists public.usage_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,

  type       text not null check (type in
               ('transcription','audio_analysis','design_generation','scene_regeneration','export')),
  quantity   numeric not null default 1,

  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_day_idx
  on public.usage_events (user_id, type, created_at desc);

/* ------------------------------------------------------------------ */
/* updated_at                                                          */
/* ------------------------------------------------------------------ */

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

drop trigger if exists transcripts_touch on public.transcripts;
create trigger transcripts_touch before update on public.transcripts
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

/* ------------------------------------------------------------------ */
/* Row level security                                                  */
/* ------------------------------------------------------------------ */

alter table public.profiles     enable row level security;
alter table public.projects     enable row level security;
alter table public.assets       enable row level security;
alter table public.transcripts  enable row level security;
alter table public.exports      enable row level security;
alter table public.usage_events enable row level security;

-- profiles: a user sees and edits only their own row, and cannot create or
-- delete one (the signup trigger owns that).
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Every other table: full CRUD, scoped to the owner.
-- `with check` on insert and update is what stops a user writing a row that
-- claims to belong to somebody else.
do $$
declare
  t text;
begin
  foreach t in array array['projects','assets','transcripts','exports','usage_events']
  loop
    execute format('drop policy if exists %I_select_own on public.%I', t, t);
    execute format(
      'create policy %I_select_own on public.%I for select using (user_id = (select auth.uid()))', t, t);

    execute format('drop policy if exists %I_insert_own on public.%I', t, t);
    execute format(
      'create policy %I_insert_own on public.%I for insert with check (user_id = (select auth.uid()))', t, t);

    execute format('drop policy if exists %I_update_own on public.%I', t, t);
    execute format(
      'create policy %I_update_own on public.%I for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t, t);

    execute format('drop policy if exists %I_delete_own on public.%I', t, t);
    execute format(
      'create policy %I_delete_own on public.%I for delete using (user_id = (select auth.uid()))', t, t);
  end loop;
end;
$$;

/* ------------------------------------------------------------------ */
/* Free-tier guards                                                    */
/* ------------------------------------------------------------------ */

-- Enforced in the database as well as the UI, because a client-side limit is a
-- suggestion. One enthusiastic tester should not be able to consume the whole
-- R2 allowance for the month.
create or replace function public.enforce_project_limit()
returns trigger
language plpgsql
as $$
declare
  project_count integer;
begin
  select count(*) into project_count from public.projects where user_id = new.user_id;
  if project_count >= 10 then
    raise exception 'Project limit reached (10). Delete a project to make room.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_limit on public.projects;
create trigger projects_limit before insert on public.projects
  for each row execute function public.enforce_project_limit();

/* ------------------------------------------------------------------ */
/* Usage helper                                                        */
/* ------------------------------------------------------------------ */

-- Lets the app show "7 of 10 designs used today" without a second round trip.
create or replace function public.usage_today(event_type text)
returns integer
language sql
stable
security invoker
as $$
  select coalesce(sum(quantity), 0)::integer
  from public.usage_events
  where user_id = (select auth.uid())
    and type = event_type
    and created_at >= date_trunc('day', now());
$$;
