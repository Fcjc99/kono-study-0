-- "Send feedback" from inside KONO. Safe to run more than once.
-- Signed-in people can send feedback (with the page they were on); only KONO support can read it.
-- Feedback stays until support deletes it, or the account is deleted.

create table if not exists public.kono_feedback (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  message text not null check (char_length(message) between 1 and 2000),
  page text check (page is null or char_length(page) <= 200),
  app_version text check (app_version is null or char_length(app_version) <= 80),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);

alter table public.kono_feedback enable row level security;
revoke all on public.kono_feedback from anon, authenticated;
grant insert on public.kono_feedback to authenticated;
grant select, delete on public.kono_feedback to authenticated;

drop policy if exists "KONO users send their own feedback" on public.kono_feedback;
create policy "KONO users send their own feedback"
on public.kono_feedback for insert to authenticated
with check (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "KONO support reads feedback" on public.kono_feedback;
create policy "KONO support reads feedback"
on public.kono_feedback for select to authenticated
using (public.kono_is_admin());

drop policy if exists "KONO support clears feedback" on public.kono_feedback;
create policy "KONO support clears feedback"
on public.kono_feedback for delete to authenticated
using (public.kono_is_admin());
