-- Lock-screen reminders (Web Push). Safe to run more than once.
--
-- 1. kono_push_subscriptions: each device where someone turned reminders on (only they can see or
--    remove theirs).
-- 2. kono_push_queue: that person's upcoming reminders for the next week, written by their own app
--    (due today, exams tomorrow, classes starting soon). Only they can see or change theirs.
-- 3. Every 5 minutes pg_cron asks KONO's server (api/push-send) to send what's due. The server claims
--    due reminders with kono_push_claim(secret); the secret lives only in kono_push_settings (no
--    access for anyone signed in) and in the Vercel project's PUSH_CRON_SECRET.
--
-- After running this file, once:
--   update public.kono_push_settings set site_url = 'https://YOUR-KONO-SITE' where id = 1;
--   select secret from public.kono_push_settings;   -- copy into Vercel as PUSH_CRON_SECRET

create table if not exists public.kono_push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  endpoint text not null unique check (char_length(endpoint) <= 1000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
alter table public.kono_push_subscriptions enable row level security;
revoke all on public.kono_push_subscriptions from anon, authenticated;
grant select, insert, delete on public.kono_push_subscriptions to authenticated;
drop policy if exists "KONO users manage their own devices" on public.kono_push_subscriptions;
create policy "KONO users manage their own devices" on public.kono_push_subscriptions for all to authenticated
  using (auth.uid() is not null and user_id = auth.uid()) with check (auth.uid() is not null and user_id = auth.uid());

create table if not exists public.kono_push_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  send_at timestamptz not null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 300),
  tag text check (tag is null or char_length(tag) <= 120)
);
create index if not exists kono_push_queue_send_at on public.kono_push_queue(send_at);
alter table public.kono_push_queue enable row level security;
revoke all on public.kono_push_queue from anon, authenticated;
grant select, insert, delete on public.kono_push_queue to authenticated;
drop policy if exists "KONO users manage their own reminders" on public.kono_push_queue;
create policy "KONO users manage their own reminders" on public.kono_push_queue for all to authenticated
  using (auth.uid() is not null and user_id = auth.uid()) with check (auth.uid() is not null and user_id = auth.uid() and send_at < now() + interval '15 days');

-- No one's queue grows without limit.
create or replace function public.kono_push_queue_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.kono_push_queue where user_id = new.user_id) >= 300 then
    raise exception 'Too many reminders queued';
  end if;
  return new;
end;
$$;
drop trigger if exists kono_push_queue_limit on public.kono_push_queue;
create trigger kono_push_queue_limit before insert on public.kono_push_queue for each row execute function public.kono_push_queue_limit();

create table if not exists public.kono_push_settings (
  id integer primary key check (id = 1),
  site_url text,
  secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
alter table public.kono_push_settings enable row level security;
revoke all on public.kono_push_settings from anon, authenticated;
insert into public.kono_push_settings(id) values (1) on conflict (id) do nothing;

-- Called by KONO's server with the secret: hands over reminders that are due (with the devices to send
-- them to) and removes them from the queue. Reminders more than 2 hours late are dropped, not sent.
create or replace function public.kono_push_claim(p_secret text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if p_secret is null or p_secret <> (select secret from public.kono_push_settings where id = 1) then
    raise exception 'Not allowed';
  end if;
  delete from public.kono_push_queue where send_at < now() - interval '2 hours';
  with due as (
    delete from public.kono_push_queue where send_at <= now() returning user_id, title, body, tag
  )
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'title', d.title, 'body', d.body, 'tag', d.tag)), '[]'::jsonb)
    into result from due d join public.kono_push_subscriptions s on s.user_id = d.user_id;
  return result;
end;
$$;

-- A device that no longer accepts reminders (uninstalled, permission removed) is forgotten.
create or replace function public.kono_push_forget(p_secret text, p_endpoint text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is null or p_secret <> (select secret from public.kono_push_settings where id = 1) then
    raise exception 'Not allowed';
  end if;
  delete from public.kono_push_subscriptions where endpoint = p_endpoint;
end;
$$;

revoke all on function public.kono_push_claim(text) from public, authenticated;
revoke all on function public.kono_push_forget(text, text) from public, authenticated;
grant execute on function public.kono_push_claim(text) to anon;
grant execute on function public.kono_push_forget(text, text) to anon;

-- Every 5 minutes, ask KONO's server to send due reminders (needs pg_cron and pg_net; Supabase has both).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
    perform cron.schedule('kono-push-reminders', '*/5 * * * *', $job$
      select net.http_post(
        url := s.site_url || '/api/push-send',
        headers := jsonb_build_object('content-type', 'application/json', 'x-kono-cron', s.secret),
        body := '{}'::jsonb)
      from public.kono_push_settings s where s.id = 1 and s.site_url like 'https://%'
    $job$);
  else
    raise notice 'pg_cron or pg_net is not available here; reminders are queued but not sent.';
  end if;
end;
$$;
