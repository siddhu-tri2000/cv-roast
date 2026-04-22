-- ============================================================================
-- CareerCompass DB schema
-- Run this once in Supabase Dashboard → SQL Editor → New Query → paste → Run.
-- Re-running is safe (uses IF NOT EXISTS / OR REPLACE).
-- ============================================================================

create table if not exists public.searches (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  profile       jsonb not null,
  target_role   text,
  location      text,
  result        jsonb not null,
  created_at    timestamptz not null default now()
);

create index if not exists searches_user_idx on public.searches (user_id, created_at desc);
create index if not exists searches_created_idx on public.searches (created_at desc);

create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  event_type    text not null,
  payload       jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists events_type_created_idx on public.events (event_type, created_at desc);

alter table public.searches enable row level security;
alter table public.events   enable row level security;

drop policy if exists "users read own searches" on public.searches;
create policy "users read own searches" on public.searches
  for select to authenticated
  using (auth.uid() = user_id);

create or replace view public.public_stats as
select
  (select count(*) from public.searches where created_at > now() - interval '7 days') as searches_7d,
  (select count(*) from public.searches) as searches_total,
  (select count(distinct user_id) from public.searches where user_id is not null) as users_total;

grant select on public.public_stats to anon, authenticated;
