-- Every email a workflow sends. Messages hold names and email addresses: RLS is
-- on with no policies, so only the service role can read or write.
create table if not exists public.outbox (
  key text primary key,
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent')),
  created_at timestamptz not null default now(),
  approved_by text,
  approved_at timestamptz,
  sent_at timestamptz,
  provider_id text,
  check (status = 'draft' or (approved_by is not null and approved_at is not null)),
  check (status <> 'sent' or sent_at is not null)
);

alter table public.outbox enable row level security;

comment on table public.outbox is
  'Drafted, approved, and sent emails, one row per idempotency key. Access is restricted to the service role.';
