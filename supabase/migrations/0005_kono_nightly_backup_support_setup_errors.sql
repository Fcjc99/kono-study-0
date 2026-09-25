-- Nightly backups, support can set up a brand-new account, and an app error log for support.
-- Safe to run more than once.
--
-- 1. Every evening (03:00 UTC = 11pm US Eastern / 8pm Pacific in summer) each account's saved plan is
--    copied into kono_plan_nightly: one row per account, overwritten each night. Needs the pg_cron
--    extension (Supabase: Database > Extensions > pg_cron); without it the table and function still
--    work and the schedule is simply skipped.
-- 2. kono_admin_save_plan can create the first plan for an account that doesn't have one yet, so KONO
--    support can set everything up before the person ever signs in.
-- 3. kono_client_errors: signed-in browsers report unexpected app errors; only KONO support can read
--    them. Kept for 30 days.

-- ---------------------------------------------------------------- nightly backup
create table if not exists public.kono_plan_nightly (
  owner uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null,
  data jsonb not null,
  saved_at timestamptz not null default now()
);

alter table public.kono_plan_nightly enable row level security;
revoke all on public.kono_plan_nightly from anon, authenticated;
grant select on public.kono_plan_nightly to authenticated;

drop policy if exists "KONO users read their own nightly backup" on public.kono_plan_nightly;
create policy "KONO users read their own nightly backup"
on public.kono_plan_nightly for select to authenticated
using (auth.uid() is not null and owner = auth.uid());

-- Runs as the database owner from pg_cron; nobody signed in can call it.
create or replace function public.kono_nightly_backup() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  copied integer;
begin
  insert into public.kono_plan_nightly(owner, revision, data, saved_at)
    select p.owner, p.revision, p.data, now() from public.kono_plans p where p.data is not null
  on conflict (owner) do update
    set revision = excluded.revision, data = excluded.data, saved_at = excluded.saved_at
    where public.kono_plan_nightly.revision is distinct from excluded.revision;
  get diagnostics copied = row_count;
  delete from public.kono_client_errors where created_at < now() - interval '30 days';
  return copied;
end;
$$;

-- ---------------------------------------------------------------- app error log
create table if not exists public.kono_client_errors (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  message text not null check (char_length(message) between 1 and 1000),
  detail text check (detail is null or char_length(detail) <= 4000),
  page text check (page is null or char_length(page) <= 200),
  app_version text check (app_version is null or char_length(app_version) <= 80),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);

alter table public.kono_client_errors enable row level security;
revoke all on public.kono_client_errors from anon, authenticated;
grant insert on public.kono_client_errors to authenticated;
grant select on public.kono_client_errors to authenticated;

drop policy if exists "KONO users report their own app errors" on public.kono_client_errors;
create policy "KONO users report their own app errors"
on public.kono_client_errors for insert to authenticated
with check (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "KONO support reads app errors" on public.kono_client_errors;
create policy "KONO support reads app errors"
on public.kono_client_errors for select to authenticated
using (public.kono_is_admin());

revoke all on function public.kono_nightly_backup() from public, anon, authenticated;

-- ---------------------------------------------------------------- support: first plan + nightly copy
create or replace function public.kono_admin_save_plan(
  p_owner uuid,
  p_expected_revision bigint,
  p_operation_id uuid,
  p_data jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin uuid := auth.uid();
  current_revision bigint;
  current_operation uuid;
  next_revision bigint;
begin
  if not public.kono_is_admin() then raise exception 'KONO support access only'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'A plan is required'; end if;
  select revision, operation into current_revision, current_operation
    from public.kono_plans where owner = p_owner for update;
  if not found then
    -- Setting up an account that has never saved: only as its very first plan.
    if p_expected_revision <> 0 then
      return jsonb_build_object('revision', 0, 'conflict', true);
    end if;
    if not exists (select 1 from auth.users where id = p_owner) then raise exception 'Unknown account'; end if;
    next_revision := 1;
    begin
      insert into public.kono_plans(owner, revision, data, operation)
        values (p_owner, next_revision, p_data, p_operation_id);
    exception when unique_violation then
      return jsonb_build_object('revision', 0, 'conflict', true);
    end;
  else
    if current_operation = p_operation_id then
      return jsonb_build_object('revision', current_revision, 'conflict', false);
    end if;
    if current_revision <> p_expected_revision then
      return jsonb_build_object('revision', current_revision, 'conflict', true);
    end if;
    next_revision := current_revision + 1;
    update public.kono_plans set revision = next_revision, data = p_data,
      operation = p_operation_id, updated_at = now() where owner = p_owner;
  end if;
  insert into public.kono_plan_history(owner, revision, data, changed_by)
    values (p_owner, next_revision, p_data, admin) on conflict do nothing;
  delete from public.kono_plan_history
    where owner = p_owner and revision < next_revision - 19;
  insert into public.kono_admin_audit(admin_id, account_id, action, revision)
    values (admin, p_owner, 'edit', next_revision);
  return jsonb_build_object('revision', next_revision, 'conflict', false);
end;
$$;

-- An account's last nightly backup, for support to hand back or restore. Logged as a view.
create or replace function public.kono_admin_get_nightly(p_owner uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_row public.kono_plan_nightly;
begin
  if not public.kono_is_admin() then raise exception 'KONO support access only'; end if;
  select * into found_row from public.kono_plan_nightly where owner = p_owner;
  if not found then return null; end if;
  insert into public.kono_admin_audit(admin_id, account_id, action, revision)
    values (auth.uid(), p_owner, 'view', found_row.revision);
  return jsonb_build_object('revision', found_row.revision, 'saved_at', found_row.saved_at, 'data', found_row.data);
end;
$$;

revoke all on function public.kono_admin_get_nightly(uuid) from public, anon;
grant execute on function public.kono_admin_get_nightly(uuid) to authenticated;

-- Deleting your cloud study data also deletes its nightly backup.
create or replace function public.kono_delete_plan(
  p_expected_revision bigint,
  p_operation_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  current_revision bigint;
  next_revision bigint;
begin
  if account_id is null then raise exception 'Authentication required'; end if;
  select revision into current_revision from public.kono_plans
    where owner = account_id for update;
  if not found or current_revision <> p_expected_revision then
    return jsonb_build_object('revision', coalesce(current_revision, 0), 'conflict', true);
  end if;
  next_revision := current_revision + 1;
  update public.kono_plans set revision = next_revision, data = null,
    operation = p_operation_id, updated_at = now() where owner = account_id;
  delete from public.kono_plan_history where owner = account_id;
  delete from public.kono_plan_backups where owner = account_id;
  perform public.kono_forget_nightly(account_id);
  return jsonb_build_object('revision', next_revision, 'conflict', false);
end;
$$;

-- kono_delete_plan runs as the signed-in person, who can't write kono_plan_nightly directly.
create or replace function public.kono_forget_nightly(p_owner uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() <> p_owner then raise exception 'Not allowed'; end if;
  delete from public.kono_plan_nightly where owner = p_owner;
end;
$$;
revoke all on function public.kono_forget_nightly(uuid) from public, anon;
grant execute on function public.kono_forget_nightly(uuid) to authenticated;

-- ---------------------------------------------------------------- schedule (Supabase pg_cron)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('kono-nightly-backup', '0 3 * * *', 'select public.kono_nightly_backup()');
  else
    raise notice 'pg_cron is not available here; nightly backups are not scheduled.';
  end if;
end;
$$;
