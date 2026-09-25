-- Automatic backups, and KONO support access.
--
-- 1. Every time a signed-in person opens KONO, a copy of their saved plan is kept in
--    kono_plan_backups (skipped when nothing changed since the last one; newest 30 kept).
--    These are separate from kono_plan_history, which rolls over after 20 saves.
-- 2. KONO support: accounts listed in kono_admins can list every account and open, view and
--    edit its plan to help. Only the database owner can add an admin (Supabase SQL editor):
--      insert into public.kono_admins(user_id) select id from auth.users where email = '<your email>';
--    Every view and edit is written to kono_admin_audit, which each person can read for their own
--    account, and an edit's history entry records who made it (changed_by).

-- ---------------------------------------------------------------- automatic backups
create table if not exists public.kono_plan_backups (
  owner uuid not null references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  data jsonb not null,
  reason text not null default 'open' check (reason in ('open', 'before-support')),
  created_at timestamptz not null default now(),
  primary key (owner, revision)
);

alter table public.kono_plan_backups enable row level security;
revoke all on public.kono_plan_backups from anon;
grant select, insert, delete on public.kono_plan_backups to authenticated;

create policy "KONO users read their own backups"
on public.kono_plan_backups for select to authenticated
using (auth.uid() is not null and owner = auth.uid());

create policy "KONO users create their own backups"
on public.kono_plan_backups for insert to authenticated
with check (auth.uid() is not null and owner = auth.uid());

create policy "KONO users delete their own backups"
on public.kono_plan_backups for delete to authenticated
using (auth.uid() is not null and owner = auth.uid());

create or replace function public.kono_backup_on_open() returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  saved_revision bigint;
  added integer := 0;
begin
  if account_id is null then raise exception 'Authentication required'; end if;
  select revision into saved_revision from public.kono_plans
    where owner = account_id and data is not null;
  if not found then return jsonb_build_object('backedUp', false, 'revision', 0); end if;
  insert into public.kono_plan_backups(owner, revision, data, reason)
    select owner, revision, data, 'open' from public.kono_plans where owner = account_id
    on conflict (owner, revision) do nothing;
  get diagnostics added = row_count;
  delete from public.kono_plan_backups b
    where b.owner = account_id and b.revision not in (
      select k.revision from public.kono_plan_backups k where k.owner = account_id
      order by k.revision desc limit 30);
  return jsonb_build_object('backedUp', added > 0, 'revision', saved_revision);
end;
$$;

revoke all on function public.kono_backup_on_open() from public, anon;
grant execute on function public.kono_backup_on_open() to authenticated;

-- Deleting your cloud study data also deletes its automatic backups.
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
  return jsonb_build_object('revision', next_revision, 'conflict', false);
end;
$$;

-- ---------------------------------------------------------------- KONO support
create table if not exists public.kono_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
-- No policies and no grants: signed-in users can neither read nor change who is an admin.
alter table public.kono_admins enable row level security;
revoke all on public.kono_admins from anon, authenticated;

create or replace function public.kono_is_admin() returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.kono_admins where user_id = auth.uid()) $$;

revoke all on function public.kono_is_admin() from public, anon;
grant execute on function public.kono_is_admin() to authenticated;

create table if not exists public.kono_admin_audit (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id) on delete set null,
  account_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('view', 'edit')),
  revision bigint,
  created_at timestamptz not null default now()
);

alter table public.kono_admin_audit enable row level security;
revoke all on public.kono_admin_audit from anon, authenticated;
grant select on public.kono_admin_audit to authenticated;

create policy "KONO users see support activity on their own account"
on public.kono_admin_audit for select to authenticated
using (auth.uid() is not null and account_id = auth.uid());

create policy "KONO admins see all support activity"
on public.kono_admin_audit for select to authenticated
using (public.kono_is_admin());

alter table public.kono_plan_history
  add column if not exists changed_by uuid references auth.users(id) on delete set null;

-- Every account, with its study profiles, for the support list.
create or replace function public.kono_admin_accounts()
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  revision bigint,
  updated_at timestamptz,
  profiles text,
  username text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.kono_is_admin() then raise exception 'KONO support access only'; end if;
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at,
      p.revision, p.updated_at,
      (select string_agg(coalesce(pr->>'name', '') || ' · ' || coalesce(pr->>'label', ''), ', ')
         from jsonb_array_elements(case when jsonb_typeof(p.data->'profiles') = 'array' then p.data->'profiles' else '[]'::jsonb end) pr),
      kp.username
    from auth.users u
    left join public.kono_plans p on p.owner = u.id
    left join public.kono_profiles kp on kp.user_id = u.id
    order by coalesce(p.updated_at, u.created_at) desc;
end;
$$;

-- Opening an account to help keeps a backup of it first, then logs the view.
create or replace function public.kono_admin_get_plan(p_owner uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin uuid := auth.uid();
  found_revision bigint;
  found_data jsonb;
begin
  if not public.kono_is_admin() then raise exception 'KONO support access only'; end if;
  select revision, data into found_revision, found_data from public.kono_plans where owner = p_owner;
  -- KONO re-reads the plan on every sync, so one support session is logged (and backed up) once
  -- per half hour rather than once per save.
  if not exists (select 1 from public.kono_admin_audit where admin_id = admin and account_id = p_owner
      and action = 'view' and created_at > now() - interval '30 minutes') then
    if found_data is not null then
      insert into public.kono_plan_backups(owner, revision, data, reason)
        values (p_owner, found_revision, found_data, 'before-support')
        on conflict (owner, revision) do nothing;
    end if;
    insert into public.kono_admin_audit(admin_id, account_id, action, revision)
      values (admin, p_owner, 'view', coalesce(found_revision, 0));
  end if;
  return jsonb_build_object('revision', coalesce(found_revision, 0), 'data', found_data);
end;
$$;

-- Same optimistic-revision rules as kono_save_plan, for another account; logged and attributed.
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
    return jsonb_build_object('revision', 0, 'conflict', true);
  end if;
  if current_operation = p_operation_id then
    return jsonb_build_object('revision', current_revision, 'conflict', false);
  end if;
  if current_revision <> p_expected_revision then
    return jsonb_build_object('revision', current_revision, 'conflict', true);
  end if;
  next_revision := current_revision + 1;
  update public.kono_plans set revision = next_revision, data = p_data,
    operation = p_operation_id, updated_at = now() where owner = p_owner;
  insert into public.kono_plan_history(owner, revision, data, changed_by)
    values (p_owner, next_revision, p_data, admin) on conflict do nothing;
  delete from public.kono_plan_history
    where owner = p_owner and revision < next_revision - 19;
  insert into public.kono_admin_audit(admin_id, account_id, action, revision)
    values (admin, p_owner, 'edit', next_revision);
  return jsonb_build_object('revision', next_revision, 'conflict', false);
end;
$$;

revoke all on function public.kono_admin_accounts() from public, anon;
revoke all on function public.kono_admin_get_plan(uuid) from public, anon;
revoke all on function public.kono_admin_save_plan(uuid, bigint, uuid, jsonb) from public, anon;
grant execute on function public.kono_admin_accounts() to authenticated;
grant execute on function public.kono_admin_get_plan(uuid) to authenticated;
grant execute on function public.kono_admin_save_plan(uuid, bigint, uuid, jsonb) to authenticated;
