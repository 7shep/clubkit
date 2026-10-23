-- Generalized from QMIND's careers applications table. Applications hold
-- personal data: RLS is on with no policies, so only the service role can read or write.
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  full_name text not null,
  email text not null,
  graduation_year integer not null,
  program text not null,
  position text not null,
  answers jsonb not null default '{}'::jsonb,
  resume_path text,
  consent boolean not null check (consent),
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewing', 'interview', 'accepted', 'rejected', 'withdrawn')),
  unique (email, position)
);

alter table public.applications enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-resumes',
  'application-resumes',
  false,
  8388608,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.applications is
  'Club applications. Access is restricted to the service role.';
