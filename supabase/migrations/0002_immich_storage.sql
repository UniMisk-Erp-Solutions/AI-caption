-- Immich as a storage backend alongside R2.
--
-- Run this in the Supabase SQL editor after 0001_init.sql.

/* ------------------------------------------------------------------ */
/* assets: unique key for upserts                                      */
/* ------------------------------------------------------------------ */

-- The client upserts asset rows on (provider, object_key), which needs a
-- matching unique index to behave as an upsert rather than inserting duplicates
-- every time a project is re-exported.
--
-- This row is also load-bearing for security with Immich. Immich asset ids
-- carry no owner information, so unlike an R2 key the Worker cannot read
-- ownership off the id - it looks the key up in this table instead, under RLS,
-- so a row only comes back if it genuinely belongs to the caller. A missing or
-- duplicated row means playback and deletion correctly refuse the file.
create unique index if not exists assets_provider_object_key_uidx
  on public.assets (provider, object_key);

/* ------------------------------------------------------------------ */
/* assets: allow the immich provider                                   */
/* ------------------------------------------------------------------ */

alter table public.assets drop constraint if exists assets_provider_check;
alter table public.assets add constraint assets_provider_check
  check (provider in ('r2', 'immich', 'local'));

/* ------------------------------------------------------------------ */
/* projects: remember which backend holds the source                   */
/* ------------------------------------------------------------------ */

-- Without this a project whose source lives in Immich is indistinguishable from
-- one in R2, and the read path would sign the wrong kind of URL.
alter table public.projects
  add column if not exists source_provider text
  check (source_provider is null or source_provider in ('r2', 'immich', 'local'));

/* ------------------------------------------------------------------ */
/* Cleanup helper                                                      */
/* ------------------------------------------------------------------ */

-- Deleting a project cascades its rows away, which would otherwise lose the
-- object keys before anything could delete the actual files. This keeps them
-- briefly so a cleanup pass can reclaim the storage.
create table if not exists public.orphaned_objects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  provider   text not null,
  object_key text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists orphaned_objects_pending_idx
  on public.orphaned_objects (user_id, deleted_at);

alter table public.orphaned_objects enable row level security;

drop policy if exists orphaned_objects_select_own on public.orphaned_objects;
create policy orphaned_objects_select_own on public.orphaned_objects
  for select using (user_id = (select auth.uid()));

drop policy if exists orphaned_objects_insert_own on public.orphaned_objects;
create policy orphaned_objects_insert_own on public.orphaned_objects
  for insert with check (user_id = (select auth.uid()));

drop policy if exists orphaned_objects_update_own on public.orphaned_objects;
create policy orphaned_objects_update_own on public.orphaned_objects
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.remember_orphans()
returns trigger
language plpgsql
as $$
begin
  insert into public.orphaned_objects (user_id, provider, object_key)
  select user_id, provider, object_key
  from public.assets
  where project_id = old.id
  on conflict do nothing;
  return old;
end;
$$;

drop trigger if exists projects_remember_orphans on public.projects;
create trigger projects_remember_orphans before delete on public.projects
  for each row execute function public.remember_orphans();
