-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Then add both of your email addresses at the bottom and run that part too.

create table if not exists public.members (
  email text primary key
);

create table if not exists public.movies (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer unique,
  imdb_id text,
  title text not null,
  year integer,
  runtime integer,             -- minutes
  genres text[] not null default '{}',
  rating numeric(3,1),         -- TMDB audience score, 0-10
  vote_count integer,
  poster_path text,
  overview text,
  note text,
  added_by text,               -- email of whoever added it
  watched boolean not null default false,
  watched_at timestamptz,
  created_at timestamptz not null default now()
);

-- Only people listed in public.members can read or change the list.
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

alter table public.members enable row level security;
alter table public.movies enable row level security;

drop policy if exists "members can see members" on public.members;
create policy "members can see members" on public.members
  for select to authenticated using (public.is_member());

drop policy if exists "members manage movies" on public.movies;
create policy "members manage movies" on public.movies
  for all to authenticated using (public.is_member()) with check (public.is_member());

-- Live sync between the two of you.
do $$ begin
  alter publication supabase_realtime add table public.movies;
exception when duplicate_object then null;
end $$;

-- Add the two people who share the list:
-- insert into public.members (email) values ('you@example.com'), ('partner@example.com');
