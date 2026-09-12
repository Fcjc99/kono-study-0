-- Peer-to-peer sharing between classmates: a username directory (not a public list —
-- only signed-in KONO accounts can search it), friend connections, and a pruned
-- "school-related only" snapshot each student publishes for their accepted connections
-- to read. A friend's reminders, notes, sanctuary data and settings are never written
-- to kono_shared_snapshots, and the column check keeps each snapshot small.

create table if not exists public.kono_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,32}$'),
  display_name text check (display_name is null or char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);

alter table public.kono_profiles enable row level security;
revoke all on public.kono_profiles from anon;
grant select, insert, update on public.kono_profiles to authenticated;

create policy "Signed-in users can search the username directory"
on public.kono_profiles for select to authenticated
using (true);

create policy "Users create their own username"
on public.kono_profiles for insert to authenticated
with check (auth.uid() is not null and user_id = auth.uid());

create policy "Users update their own username"
on public.kono_profiles for update to authenticated
using (auth.uid() is not null and user_id = auth.uid())
with check (auth.uid() is not null and user_id = auth.uid());

-- One row per pair of students; a unique pair key prevents duplicate requests in
-- either direction once a row (pending, accepted or declined) already exists.
create table if not exists public.kono_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> recipient_id)
);

create unique index if not exists kono_connections_pair_key
  on public.kono_connections (least(requester_id, recipient_id), greatest(requester_id, recipient_id));

alter table public.kono_connections enable row level security;
revoke all on public.kono_connections from anon;
grant select, insert, update, delete on public.kono_connections to authenticated;

create policy "Users see their own connections"
on public.kono_connections for select to authenticated
using (auth.uid() = requester_id or auth.uid() = recipient_id);

create policy "Users send connection requests"
on public.kono_connections for insert to authenticated
with check (auth.uid() = requester_id and requester_id <> recipient_id);

create policy "Either side can update a connection they are part of"
on public.kono_connections for update to authenticated
using (auth.uid() = requester_id or auth.uid() = recipient_id)
with check (auth.uid() = requester_id or auth.uid() = recipient_id);

create policy "Either side can remove a connection they are part of"
on public.kono_connections for delete to authenticated
using (auth.uid() = requester_id or auth.uid() = recipient_id);

-- The pruned, school-only snapshot. Only its owner can write it; an accepted
-- connection may read it, never edit it.
create table if not exists public.kono_shared_snapshots (
  owner uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (octet_length(data::text) <= 200000),
  updated_at timestamptz not null default now()
);

alter table public.kono_shared_snapshots enable row level security;
revoke all on public.kono_shared_snapshots from anon;
grant select, insert, update, delete on public.kono_shared_snapshots to authenticated;

create policy "Owners manage their own shared snapshot"
on public.kono_shared_snapshots for all to authenticated
using (auth.uid() = owner)
with check (auth.uid() = owner);

create policy "Accepted connections can read a friend's shared snapshot"
on public.kono_shared_snapshots for select to authenticated
using (
  exists (
    select 1 from public.kono_connections c
    where c.status = 'accepted'
      and ((c.requester_id = owner and c.recipient_id = auth.uid())
        or (c.recipient_id = owner and c.requester_id = auth.uid()))
  )
);
