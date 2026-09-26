-- Built-in AI (KONO's own OpenAI key, used when a person hasn't added their own): a daily limit per
-- account. Safe to run more than once.
--
-- api/ai.ts calls kono_ai_take() as the signed-in person before every AI request. It counts today's
-- requests (UTC day) and answers whether one more is allowed: 40 a day, 400 for KONO support. People
-- can read their own count; nobody can change it except through this function.

create table if not exists public.kono_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  requests integer not null default 0,
  primary key (user_id, day)
);

alter table public.kono_ai_usage enable row level security;
revoke all on public.kono_ai_usage from anon, authenticated;
grant select on public.kono_ai_usage to authenticated;

drop policy if exists "KONO users see their own AI use" on public.kono_ai_usage;
create policy "KONO users see their own AI use"
on public.kono_ai_usage for select to authenticated
using (auth.uid() is not null and user_id = auth.uid());

create or replace function public.kono_ai_take() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  daily_limit integer := case when public.kono_is_admin() then 400 else 40 end;
  used integer;
begin
  if account_id is null then raise exception 'Authentication required'; end if;
  insert into public.kono_ai_usage(user_id, day, requests) values (account_id, today, 0)
    on conflict (user_id, day) do nothing;
  update public.kono_ai_usage set requests = requests + 1
    where user_id = account_id and day = today and requests < daily_limit
    returning requests into used;
  -- Old days are only needed for "used today"; keep a week.
  delete from public.kono_ai_usage where user_id = account_id and day < today - 7;
  if used is null then
    return jsonb_build_object('allowed', false, 'used', daily_limit, 'limit', daily_limit);
  end if;
  return jsonb_build_object('allowed', true, 'used', used, 'limit', daily_limit);
end;
$$;

revoke all on function public.kono_ai_take() from public, anon;
grant execute on function public.kono_ai_take() to authenticated;
