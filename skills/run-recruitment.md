# Run a recruitment cycle

Use this when a club opens applications for members or exec roles.

1. Confirm with the club: positions, questions (prompt ids and text), deadline
   with timezone, and who reviews.
2. Apply `modules/applications/migrations/0001_applications.sql` to the club's
   Supabase project.
3. Set the module config `deadline` and pass it to `parseApplication` on every
   submission, server-side, using the service role key.
4. During review, change statuses only with `transition`. When a request is
   refused, report the allowed moves it lists instead of forcing the status.
5. Report progress with `pipelineSummary(applications, position)`; share counts,
   never applicant details, in public channels.
6. After decisions, every applicant should be in `accepted`, `rejected`, or
   `withdrawn`. Flag any still `submitted`, `reviewing`, or `interview`.

Not yet automated: the public form, reviewer scoring, and decision emails.
