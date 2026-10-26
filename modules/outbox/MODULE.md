# outbox

Every email that reaches a real person goes through the outbox: a workflow
drafts it, a named exec approves it, then it is sent exactly once.

## Use it for

- Queueing messages: `draft(outbox, emails)`. Keys already in the outbox are skipped.
- Recording an exec's approval: `approve(outbox, "Priya Shah", { keys? })`.
- Sending: `sendApproved(outbox, emailAdapter, { onSent })`. Only `approved` messages go out.
- Filling copy: `renderTemplate(template, fields)`.
- Reporting: `outboxSummary(outbox)`.
- Tests: `createFakeEmail()` delivers to memory; `failOn` simulates a provider failure.

From the command line: `pnpm clubkit outbox list|approve|send --outbox <file>`.
With a club config, `outbox approve --by` accepts only the config's `approvers`.

## The lifecycle

```
draft ─→ approved ─→ sent
```

`key` is the idempotency key, e.g. `decision:<applicationId>`. A key is drafted
at most once, so re-running a workflow after a crash or a partial send never
emails anyone twice. Pick keys that name the purpose and the person, not the
content: a reworded template must not produce a second email.

## Contract

Shapes: `OutboxMessage`, `OutgoingEmail`, `EmailAdapter`, and `EmailTemplate`
from `@clubkit/schemas`. Functions return a new outbox; the caller stores it.

Sending goes through an injected `EmailAdapter`. No real provider is wired up
yet, so `outbox send` needs `--fake <file>`, which delivers to a JSON file. A real
adapter must pass `key` to the provider as its idempotency key.

Storage: `migrations/0001_outbox.sql` creates `public.outbox` with RLS on and no
policies: messages hold names and email addresses, so only the service role can read them.

## Rules for agents

- **Never approve on an exec's behalf.** "Send the emails" is not approval: the
  exec hasn't read the drafts. Draft, report counts, and hand over the
  `outbox list` and `outbox approve --by "<their name>"` commands. Approve only
  when an exec tells you they have read these drafts and names themselves.
- Never send a draft, edit a `sent` message, or change a key to get a message out again.
- Report counts, not names or addresses, anywhere public.
- After changing this module, run `pnpm verify outbox`.

## Not yet included

A real email provider (to be picked with QWeb), HTML email, attachments, and
scheduled sends.
