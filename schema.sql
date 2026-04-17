-- Days Since: schema + row-level security
-- Paste this into Supabase → SQL Editor → New query → Run.

create table if not exists public.trackers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  interval_days int  not null check (interval_days between 1 and 3650),
  last_reset_at timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists trackers_user_id_idx on public.trackers(user_id);

alter table public.trackers enable row level security;

drop policy if exists "select own"  on public.trackers;
drop policy if exists "insert own"  on public.trackers;
drop policy if exists "update own"  on public.trackers;
drop policy if exists "delete own"  on public.trackers;

create policy "select own"  on public.trackers for select using (auth.uid() = user_id);
create policy "insert own"  on public.trackers for insert with check (auth.uid() = user_id);
create policy "update own"  on public.trackers for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own"  on public.trackers for delete using (auth.uid() = user_id);
