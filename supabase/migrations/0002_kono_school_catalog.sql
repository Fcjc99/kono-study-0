-- Community-contributed school/college calendar catalog.
-- Readable by everyone (including signed-out/local-only devices via the anon key);
-- only signed-in users may contribute, and entries are append-only (no update/delete
-- policies) so one contributor can never overwrite or vandalize another's entry.
create table if not exists public.kono_school_catalog (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,99}$'),
  label text not null check (char_length(label) between 1 and 200),
  kind text not null check (kind in ('school','college')),
  town text check (town is null or char_length(town) <= 200),
  data jsonb not null check (octet_length(data::text) <= 200000),
  source text check (source is null or char_length(source) <= 500),
  url text check (url is null or char_length(url) <= 500),
  submitted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.kono_school_catalog enable row level security;

revoke all on public.kono_school_catalog from anon, authenticated;
grant select on public.kono_school_catalog to anon, authenticated;
grant insert on public.kono_school_catalog to authenticated;

create policy "Anyone can read the shared school catalog"
on public.kono_school_catalog for select
using (true);

create policy "Signed-in users can contribute a catalog entry"
on public.kono_school_catalog for insert to authenticated
with check (auth.uid() is not null and submitted_by = auth.uid());
