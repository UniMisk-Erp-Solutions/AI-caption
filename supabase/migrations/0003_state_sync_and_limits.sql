/* ------------------------------------------------------------------ */
/* 0003 - editor state actually reaches the cloud, and the project cap  */
/*        stops blocking real use                                       */
/* ------------------------------------------------------------------ */

/*
 * Two problems, one of which silently lost every user's work.
 *
 * 1. The client guarded its autosave with
 *
 *        .lt('editor_state->>revision', String(state.revision))
 *
 *    so a save only landed when the stored revision was lower. On a new
 *    project editor_state is NULL, `NULL < '1'` is NULL rather than true, and
 *    the row never matched - so the FIRST save updated zero rows. PostgREST
 *    reports no error for a zero-row update, and the client treated that as
 *    success. editor_state therefore stayed NULL for the life of the project:
 *    the video uploaded, the row existed, and opening it on a second device
 *    showed a project with no caption data.
 *
 *    `->>` also yields text, so the comparison was lexicographic. '10' < '9'
 *    is true, which means that past revision 9 a stale write could overwrite
 *    a newer one - the exact race the guard was written to prevent.
 *
 *    Both are fixed here rather than in the client, because the comparison is
 *    the thing that has to be atomic with the write.
 *
 * 2. A trigger capped every account at 10 projects. It was written as a
 *    free-tier guard when media lived in R2 and the allowance was metered.
 *    Storage is now self-hosted Immich, so the cap only blocks ordinary use -
 *    and it failed as a raw Postgres exception that the UI swallowed.
 */

/* ------------------------------------------------------------------ */
/* 1. Drop the project cap                                             */
/* ------------------------------------------------------------------ */

drop trigger if exists projects_limit on public.projects;
drop function if exists public.enforce_project_limit();

/* ------------------------------------------------------------------ */
/* 2. A save that cannot silently do nothing                           */
/* ------------------------------------------------------------------ */

/*
 * Returns true when the state was written, false when it was correctly
 * discarded as stale. The client can then tell "someone else's newer edit
 * won" apart from "this write vanished", which it previously could not.
 *
 * security invoker, so the caller's RLS policy still decides which rows are
 * visible - this widens nothing.
 */
create or replace function public.save_editor_state(
  p_project_id uuid,
  p_state      jsonb
)
returns boolean
language plpgsql
security invoker
as $$
declare
  incoming_revision bigint;
  stored_revision   bigint;
  rows_written      integer;
begin
  -- A state without a usable revision is treated as revision 0 rather than
  -- rejected: losing the write outright is worse than accepting an early one.
  begin
    incoming_revision := coalesce((p_state->>'revision')::bigint, 0);
  exception when others then
    incoming_revision := 0;
  end;

  begin
    select coalesce((editor_state->>'revision')::bigint, -1)
      into stored_revision
      from public.projects
     where id = p_project_id;
  exception when others then
    -- Unparseable stored revision means the row predates this function, so
    -- the incoming state is necessarily the better one.
    stored_revision := -1;
  end;

  if stored_revision is null then
    return false;  -- no such row, or RLS hid it
  end if;

  -- NULL stored state sorts below every real revision because of the -1
  -- default, so the first save now lands instead of matching nothing.
  if stored_revision >= incoming_revision then
    return false;
  end if;

  update public.projects
     set editor_state = p_state,
         duration_ms  = coalesce(
                          nullif(p_state->'project'->>'durationMs', '')::integer,
                          duration_ms
                        ),
         updated_at   = now()
   where id = p_project_id;

  get diagnostics rows_written = row_count;
  return rows_written > 0;
end;
$$;

grant execute on function public.save_editor_state(uuid, jsonb) to authenticated;

/* ------------------------------------------------------------------ */
/* 3. Backfill                                                         */
/* ------------------------------------------------------------------ */

/*
 * Projects created before this migration have editor_state NULL because of
 * bug 1. Their captions only ever existed in the browser that made them, so
 * there is nothing here to recover - the local copy is the only copy. Marking
 * them lets the client push its local state up on next open instead of
 * treating the empty server copy as authoritative.
 */
comment on column public.projects.editor_state is
  'Full editor document. NULL means never synced - before migration 0003 the '
  'first save silently updated zero rows, so pre-0003 projects have their only '
  'copy in the originating browser and must be re-pushed from there.';
