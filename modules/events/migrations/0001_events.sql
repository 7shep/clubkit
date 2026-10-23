-- Generalized from QWeb's term_events table. Public read, writes via service role only.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  date date not null,
  start_time time,
  duration_minutes integer check (duration_minutes > 0),
  location text,
  rsvp_cap integer check (rsvp_cap > 0),
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "Events are publicly readable"
  on public.events for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.events from anon, authenticated;
