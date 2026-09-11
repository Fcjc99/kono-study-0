create table if not exists public.kono_plans (
  owner uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision >= 0),
  data jsonb,
  operation uuid not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.kono_plan_history (
  owner uuid not null references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner, revision)
);

alter table public.kono_plans enable row level security;
alter table public.kono_plan_history enable row level security;

revoke all on public.kono_plans from anon;
revoke all on public.kono_plan_history from anon;
grant select, insert, update, delete on public.kono_plans to authenticated;
grant select, insert, delete on public.kono_plan_history to authenticated;

create policy "KONO users read their own plan"
on public.kono_plans for select to authenticated
using (auth.uid() is not null and owner = auth.uid());

create policy "KONO users create their own plan"
on public.kono_plans for insert to authenticated
with check (auth.uid() is not null and owner = auth.uid());

create policy "KONO users update their own plan"
on public.kono_plans for update to authenticated
using (auth.uid() is not null and owner = auth.uid())
with check (auth.uid() is not null and owner = auth.uid());

create policy "KONO users delete their own plan"
on public.kono_plans for delete to authenticated
using (auth.uid() is not null and owner = auth.uid());

create policy "KONO users read their own history"
on public.kono_plan_history for select to authenticated
using (auth.uid() is not null and owner = auth.uid());

create policy "KONO users create their own history"
on public.kono_plan_history for insert to authenticated
with check (auth.uid() is not null and owner = auth.uid());

create policy "KONO users delete their own history"
on public.kono_plan_history for delete to authenticated
using (auth.uid() is not null and owner = auth.uid());

create or replace function public.kono_save_plan(
  p_expected_revision bigint,
  p_operation_id uuid,
  p_data jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  current_revision bigint;
  current_operation uuid;
  next_revision bigint;
begin
  if account_id is null then raise exception 'Authentication required'; end if;
  select revision, operation into current_revision, current_operation
    from public.kono_plans where owner = account_id for update;
  if found and current_operation = p_operation_id then
    return jsonb_build_object('revision', current_revision, 'conflict', false);
  end if;
  if found then
    if current_revision <> p_expected_revision then
      return jsonb_build_object('revision', current_revision, 'conflict', true);
    end if;
    next_revision := current_revision + 1;
    update public.kono_plans set revision = next_revision, data = p_data,
      operation = p_operation_id, updated_at = now() where owner = account_id;
  else
    if p_expected_revision <> 0 then
      return jsonb_build_object('revision', 0, 'conflict', true);
    end if;
    next_revision := 1;
    begin
      insert into public.kono_plans(owner, revision, data, operation)
      values(account_id, next_revision, p_data, p_operation_id);
    exception when unique_violation then
      return jsonb_build_object('revision', 0, 'conflict', true);
    end;
  end if;
  insert into public.kono_plan_history(owner, revision, data)
    values(account_id, next_revision, p_data) on conflict do nothing;
  delete from public.kono_plan_history
    where owner = account_id and revision < next_revision - 19;
  return jsonb_build_object('revision', next_revision, 'conflict', false);
end;
$$;

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
  return jsonb_build_object('revision', next_revision, 'conflict', false);
end;
$$;

revoke all on function public.kono_save_plan(bigint, uuid, jsonb) from public, anon;
revoke all on function public.kono_delete_plan(bigint, uuid) from public, anon;
grant execute on function public.kono_save_plan(bigint, uuid, jsonb) to authenticated;
grant execute on function public.kono_delete_plan(bigint, uuid) to authenticated;

