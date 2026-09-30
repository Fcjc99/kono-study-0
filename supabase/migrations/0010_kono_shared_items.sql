-- Share one assignment or exam with a connected classmate. The sender picks what's sent (title, due
-- date, subject name, details, time estimate: see src/store/itemShare.ts); it waits here until the
-- classmate adds it to their plan or dismisses it. Only accepted connections can send to each other,
-- and nobody else can read it. A sender can also take back something not yet added.

create table if not exists public.kono_shared_items (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('task','exam')),
  item jsonb not null check (jsonb_typeof(item) = 'object' and octet_length(item::text) <= 4000),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists kono_shared_items_recipient on public.kono_shared_items (recipient_id, created_at);

alter table public.kono_shared_items enable row level security;
revoke all on public.kono_shared_items from anon;
revoke all on public.kono_shared_items from authenticated;
grant select, insert, delete on public.kono_shared_items to authenticated;

create policy "Students see what they sent and what was sent to them"
on public.kono_shared_items for select to authenticated
using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- Only to an accepted connection, and at most 50 waiting from one sender to one classmate.
create policy "Students share with accepted connections"
on public.kono_shared_items for insert to authenticated
with check (
  auth.uid() = sender_id
  and exists (
    select 1 from public.kono_connections c
    where c.status = 'accepted'
      and ((c.requester_id = sender_id and c.recipient_id = kono_shared_items.recipient_id)
        or (c.recipient_id = sender_id and c.requester_id = kono_shared_items.recipient_id))
  )
  and (
    select count(*) from public.kono_shared_items waiting
    where waiting.sender_id = auth.uid() and waiting.recipient_id = kono_shared_items.recipient_id
  ) < 50
);

create policy "Either side can clear a shared item"
on public.kono_shared_items for delete to authenticated
using (auth.uid() = sender_id or auth.uid() = recipient_id);
