-- Lock-screen reminders per device. Safe to run more than once.
--
-- In a family account, each phone or iPad can be on a different plan (the parent's, or a kid's), so
-- each device keeps its own queue: a reminder with an endpoint goes only to that device. Reminders
-- queued before this (no endpoint) still go to every device of the account.

alter table public.kono_push_queue add column if not exists endpoint text check (endpoint is null or char_length(endpoint) <= 1000);
create index if not exists kono_push_queue_user_endpoint on public.kono_push_queue(user_id, endpoint);

-- A device's queue can only point at one of the person's own devices.
drop policy if exists "KONO users manage their own reminders" on public.kono_push_queue;
create policy "KONO users manage their own reminders" on public.kono_push_queue for all to authenticated
  using (auth.uid() is not null and user_id = auth.uid())
  with check (auth.uid() is not null and user_id = auth.uid() and send_at < now() + interval '15 days'
    and (endpoint is null or exists (select 1 from public.kono_push_subscriptions s where s.endpoint = kono_push_queue.endpoint and s.user_id = auth.uid())));

-- 300 reminders per device, and 1,500 per account.
create or replace function public.kono_push_queue_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.kono_push_queue where user_id = new.user_id and endpoint is not distinct from new.endpoint) >= 300
     or (select count(*) from public.kono_push_queue where user_id = new.user_id) >= 1500 then
    raise exception 'Too many reminders queued';
  end if;
  return new;
end;
$$;

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
    delete from public.kono_push_queue where send_at <= now() returning user_id, endpoint, title, body, tag
  )
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'title', d.title, 'body', d.body, 'tag', d.tag)), '[]'::jsonb)
    into result from due d join public.kono_push_subscriptions s on s.user_id = d.user_id and (d.endpoint is null or s.endpoint = d.endpoint);
  return result;
end;
$$;
revoke all on function public.kono_push_claim(text) from public, authenticated;
grant execute on function public.kono_push_claim(text) to anon;
