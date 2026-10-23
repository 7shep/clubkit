# applications

Membership and hiring applications: validation, an enforced review pipeline,
and private storage.

## Use it for

- Accepting a submission: `parseApplication(input, { deadline })`.
- Moving an applicant forward: `transition(application, "interview")`.
- Asking what moves are legal: `allowedTransitions(status)`.
- Reporting progress: `pipelineSummary(applications, position?)`.
- Decision emails: `decisionEmails(applications, templates)` returns one email per
  accepted or rejected applicant, keyed `decision:<id>`, for `draft` in the
  `outbox` module. It sends nothing. See `skills/close-recruitment.md`.

## The pipeline

```
submitted ─→ reviewing ─→ interview ─→ accepted
    │            │            │     └─→ rejected
    │            ├─→ accepted
    └─→ rejected └─→ rejected
any open state ─→ withdrawn
```

`accepted`, `rejected`, and `withdrawn` are final. `transition` throws with the
allowed moves listed, so an agent can recover from a bad request.

## Contract

Shape: `Application` from `@clubkit/schemas`. `answers` maps the club's own
prompt ids to text, so each club defines its questions without schema changes.

Storage: `migrations/0001_applications.sql` creates `public.applications` and a
private `application-resumes` bucket. There are no RLS policies: only the
service role can read or write.

## Rules for agents

- Applications contain personal data. Never expose them through public pages,
  logs, or the anon key, and never commit real applicant data to this repo.
- Change status only through `transition`; do not write `status` directly.
- After changing this module, run `pnpm verify applications`.

## Not yet included

Form rendering, reviewer scoring, and interview scheduling.
