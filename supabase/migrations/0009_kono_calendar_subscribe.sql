-- Subscribe to KONO from Google Calendar or Apple Calendar. Safe to run more than once.
--
-- Someone creates a private link for one of their plans (Settings › Import & export). Calendar apps
-- fetch https://SITE/api/ics?t=TOKEN every few hours; api/ics.ts calls kono_calendar_feed(token), which
-- returns that plan's saved data only for a live token. Turning the link off deletes the token, so the
-- old link stops working.

create table if not exists public.kono_calendar_feeds (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  profile_id text not null check (char_length(profile_id) between 1 and 200),
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  primary key (user_id, profile_id)
);
alter table public.kono_calendar_feeds enable row level security;
revoke all on public.kono_calendar_feeds from anon, authenticated;
grant select, insert, delete on public.kono_calendar_feeds to authenticated;
drop policy if exists "KONO users manage their own calendar links" on public.kono_calendar_feeds;
create policy "KONO users manage their own calendar links" on public.kono_calendar_feeds for all to authenticated
  using (auth.uid() is not null and user_id = auth.uid()) with check (auth.uid() is not null and user_id = auth.uid());

-- The token must be the unguessable default: nobody picks their own.
create or replace function public.kono_calendar_feed_token() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  return new;
end;
$$;
drop trigger if exists kono_calendar_feed_token on public.kono_calendar_feeds;
create trigger kono_calendar_feed_token before insert on public.kono_calendar_feeds for each row execute function public.kono_calendar_feed_token();

create or replace function public.kono_calendar_feed(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  feed public.kono_calendar_feeds;
  plan jsonb;
begin
  if p_token is null or char_length(p_token) < 32 then return null; end if;
  select * into feed from public.kono_calendar_feeds where token = p_token;
  if not found then return null; end if;
  select data into plan from public.kono_plans where owner = feed.user_id;
  if plan is null then return null; end if;
  return jsonb_build_object('profileId', feed.profile_id, 'data', plan);
end;
$$;
revoke all on function public.kono_calendar_feed(text) from public, authenticated;
grant execute on function public.kono_calendar_feed(text) to anon;
