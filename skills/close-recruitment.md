# Close recruitment

Use this when recruitment is over and applicants need their decision emails.
Shape: decide → draft → an exec approves → send → report counts.

1. **Decide.** Every applicant should be `accepted`, `rejected`, or `withdrawn`.
   Count the rest with `pipelineSummary` and flag them: they get no email until
   they're decided. Don't decide for the execs, and change statuses only with
   `transition` (see `run-recruitment.md`).
2. **Draft.** Run
   `pnpm clubkit close-recruitment --applications <file> --outbox <file>`.
   Templates come from the club config's `decision-accepted` and
   `decision-rejected` (see `docs/club-config.md`), or from `--templates <file>`.
   It drafts one email per accepted or rejected applicant with key
   `decision:<applicationId>`, and skips anyone already in the outbox, so it is
   safe to re-run. Withdrawn applicants get no email. It sends nothing.
3. **Stop for approval.** An agent never approves. Even if you were asked to
   "send the emails", the exec hasn't read the drafts yet. Hand back the counts
   and these commands for the exec:
   `pnpm clubkit outbox list --outbox <file> --status draft`, then
   `pnpm clubkit outbox approve --outbox <file> --by "<their name>"`.
   With a club config, only a listed approver can approve.
4. **Send.** Only after approval: `pnpm clubkit outbox send --outbox <file>`.
   If it stops at a failure, re-run it; sent messages are never sent again.
5. **Report counts.** Drafted, sent, skipped as already sent, withdrawn, and
   undecided. Never names or email addresses in a public channel.

A `--templates` file is `{ "accepted": { subject, body }, "rejected": { subject, body } }`
with `{{firstName}}`, `{{fullName}}`, and `{{position}}` placeholders.
