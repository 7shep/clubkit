# TODOS

**The goal:** a guide an agent follows to run the tedious parts of a student
club, for execs who aren't developers. An exec says "announce Friday's event
everywhere" or "send the acceptance emails"; the agent follows a playbook, drafts
the work, the exec approves it where they already are (Discord or Slack), and
clubkit sends it once and logs it. Outreach, marketing, social posts,
Discord/Slack announcements and replies, recruitment, and handoffs.

## Who it's for

A club exec with an agent (Claude or similar) and no interest in TypeScript.
They never read `MODULE.md` or run `pnpm`. That means:

- **Playbooks are the product.** `skills/` is the interface; modules are the
  trusted plumbing underneath.
- **Setup is done by conversation.** The agent asks questions and writes
  `club.config.json`, and walks the exec through creating bots and keys one step
  at a time.
- **Approvals happen where execs already are:** an Approve / Reject message in
  Discord or Slack, not a CLI command.

## The system

| Layer | What it is | Where it lives | Today |
|---|---|---|---|
| **Playbooks** | What an agent runs end to end: "announce an event", "close recruitment" | `skills/` | Three: `add-a-module`, `run-recruitment`, `close-recruitment` |
| **Club config** | One club's name, timezone, channels, positions, templates, approvers, branding | `club.config.json` | None |
| **Integrations** | How clubkit touches the world: Discord, Slack, email, calendar, social | `integrations/<name>` | Email contract and a fake (`modules/outbox`); no real provider |
| **Modules** | What the club's data is and the rules it follows | `modules/<name>` | `events`, `applications`, `outbox` work; `roster`, `sponsors`, `site-core` planned |

Every workflow follows the same shape: **work out what's needed → draft →
exec approves → do it → record it.** Anything that reaches a real person (an
applicant, a sponsor, a Discord server, the public) is drafted first and sent
only after a named exec approves, and every send is logged so a re-run never
repeats it. That rule is what makes it safe to hand an agent the club's
accounts, and it matters more, not less, when the person at the controls isn't
technical.

**Where it stands (2026-10-25):** three working modules (`events`,
`applications`, `outbox`), an MCP server, a CLI and manifest validator, three
playbooks, and an eval runner with 24 tasks. Section 1 is two foundations in:

- **Club config** (`29ca8ed`): `club.config.json` holds a club's approvers,
  channels, templates, and module settings; `pnpm clubkit config check` validates
  it. `close-recruitment` reads its templates from it, and `outbox approve` only
  accepts listed approvers.
- **Integration contract** (`04202c5`): every provider is an `Adapter<T>` with
  `live`, `fake`, and `dry-run` modes; `pnpm clubkit outbox send --dry-run`
  previews without sending.

Still missing: any real integration (email and Discord are fakes only), an
approval surface outside the CLI, and a club running on it. QWeb is the first
target. `pnpm check` passes (51 tests).

**Pick up here:** the Discord integration, next in section 1. Before writing it:

- The outbox only holds emails (`to` is an email address). Posts to a channel
  need a schema change in `packages/schemas` and a new
  `modules/outbox/migrations/0002_<change>.sql`. Never edit `0001_outbox.sql`.
- Build it in `integrations/discord` against the contract in
  `docs/integration-spec.md`: fake first, live adapter second. Add
  `integrations/*` to `pnpm-workspace.yaml` and `tsconfig.json`.
- Live testing needs a test Discord server and bot token in `.env`, so get those
  from Alex. Check whether QWeb uses Discord or Slack more before committing to Discord.

Work top to bottom. The first milestone is one flow a non-technical QWeb exec
can use for real.

## 1. First slice: announce an event on Discord or Slack

Events data → drafted announcement → exec approves in Discord/Slack → posted
once → logged. It needs every foundation below, and a QWeb exec can use it the
week it works.

- [x] **Club config:** `club.config.json` (name, timezone, approvers, channels, templates, branding),
      `ClubConfigSchema` in `packages/schemas`, checked against module manifests by
      `pnpm clubkit config check`. Module settings resolve through `moduleConfig`; `close-recruitment`
      reads its templates and `outbox approve` its approvers from it. See `docs/club-config.md`.
- [x] **Integration contract:** `Adapter<T>` with `live`, `fake`, and `dry-run` modes in
      `packages/schemas`; `createRecorder`, `createFileRecorder`, and `requireEnv` in
      `packages/integrations`; dry runs leave the outbox unchanged (`outbox send --dry-run`).
      See `docs/integration-spec.md`.
- [ ] **Discord integration:** post to a channel through a bot (pick Discord or Slack first, whichever
      QWeb uses most; the other follows the same contract).
- [ ] **Approval surface:** the outbox posts each draft to a private exec channel with Approve / Reject
      buttons; only execs listed as approvers in config can approve. The CLI stays as a fallback.
- [x] **Outbox and approvals:** `modules/outbox`: `draft → approved → sent`, who approved and when,
      one message per idempotency key. CLI: `pnpm clubkit outbox list|approve|send`.
- [ ] **Audit log:** every action a workflow takes, readable by execs, with no personal data in public places.
- [ ] **Announcement drafts:** generate a post from an event (title, time in the club's timezone,
      location, RSVP link) using the club's template.
- [ ] Playbook: `skills/announce-an-event.md` (find event → draft → request approval → post → report).
- [ ] Workflow eval: the fake Discord adapter holds exactly the approved post, nothing posts without
      approval, and a re-run posts nothing new.

## 2. Setup a non-technical exec can finish

The hardest part for this audience is accounts and keys, not code.

- [ ] Playbook: `skills/set-up-your-club.md`. The agent interviews the exec (club name, timezone,
      approvers, channels) and writes `club.config.json`.
- [ ] Step-by-step guides the agent walks through: create a Discord bot and invite it, create a Slack
      app, get an email API key. Plain language, one step at a time, with what to paste where.
- [ ] `pnpm clubkit doctor`: checks config and credentials and says in plain words what's missing.
- [ ] Secrets in `.env` only, with an `.env.example`; the agent never echoes a token back.
- [ ] Have someone non-technical at QWeb do setup with only an agent. Every stall becomes a doc fix.

## 3. Announcements and replies across platforms

- [ ] **Slack integration** (or Discord, whichever wasn't first), same contract and approval flow.
- [ ] Scheduled announcements and reminders ("post 24 hours before"), still approved before posting.
- [ ] **Drafted replies:** the agent drafts answers to questions in Discord/Slack; an exec approves in
      one tap. No automatic replies to people.
- [ ] Later, maybe: auto-replies for a narrow FAQ the execs approved word for word, logged, with an
      off switch. Only after drafted replies have run for a while.

## 4. Recruitment, end to end, at QWeb

The most tedious and most visible job.

- [x] **Decision emails:** `decisionEmails` in applications and `pnpm clubkit close-recruitment`:
      one draft per accepted or rejected applicant, keyed `decision:<id>`; withdrawn and undecided get none.
      Eval: `close-recruitment`.
- [x] Playbook: `skills/close-recruitment.md` (decide → draft emails → approve → send → report counts).
- [ ] **Email integration:** send through one provider (decide which with QWeb, e.g. Resend or Postmark).
      The `EmailAdapter` contract and a fake (`createFakeEmail`, `outbox send --fake`) exist in `modules/outbox`.
- [ ] Decision emails approved through the same Discord/Slack approval surface.
- [ ] **Interview scheduling:** offer slots from interviewers' calendars, let applicants pick, send
      invites, and move applicants to `interview` through `transition`. Needs the calendar integration.
- [ ] **Calendar integration:** free/busy and invites (Google Calendar first; it's what execs use).
- [ ] **Reviewer scoring:** scores per reviewer with averages (the `applications-reviewer-scores`
      eval reference is a working start).
- [ ] **Application form** rendered from the club's prompt config.
- [ ] Run QWeb's next recruitment cycle on it. Record every place the agent or exec stalled and turn
      each into a doc fix or an eval task.
- [ ] Supabase setup guide: applying migrations in order, environment variables.

## 5. Marketing and social media

- [ ] **Marketing drafts:** event posts, captions, and a newsletter generated from events data and
      the club's branding, approved before anything goes out.
- [ ] **Social posts, assisted first:** the agent drafts the caption and prepares the media; a person
      posts it. Instagram, TikTok, and LinkedIn need business accounts and app review, and their
      posting APIs are restrictive.
- [ ] Automated posting, one platform at a time, starting with the one QWeb uses most, once its API
      access is sorted.
- [ ] Video posts: captions, thumbnails, and scheduling around a video the club made.
- [ ] Playbook: `skills/run-an-event.md` (create → announce everywhere → RSVPs → reminders → follow-up).
- [ ] **events gaps:** RSVP storage, reminders, recurring events (eval references exist for the first
      and last). Emit `VTIMEZONE` in `.ics` files.

## 6. Sponsors and outreach

- [ ] **sponsors:** promote it (the `promote-sponsors` eval reference is a start). Tiers and logos on the site.
- [ ] **Outreach pipeline:** who was contacted, when, by whom, and what they said; follow-up reminders.
- [ ] The agent drafts outreach and follow-ups from the club's sponsorship package; execs approve and send.
- [ ] Playbook: `skills/run-sponsor-outreach.md`.

## 7. Handoff and onboarding

Exec turnover happens in spring; have this ready before then.

- [ ] **roster:** promote it (the `roster-promote` and `roster-exec-handoff` eval references are a start).
      Extract from QWeb's `team_members`. Public team page, private emails.
- [ ] **handoff module:** per-role docs, access lists (accounts, drives, bot tokens and keys to rotate),
      open tasks, and "what you need to know" notes. The agent drafts them from the outgoing exec's input.
- [ ] **onboarding module:** a checklist per role or for new members (accounts, intro email, Discord
      roles, first tasks), driven by `acceptedApplicantsCsv`-style handoff from recruitment.
- [ ] Playbooks: `skills/hand-off-a-role.md` and `skills/onboard-new-members.md`.
- [ ] Workflow evals: given a roster and a role, the handoff doc covers access, open work, and contacts.

## 8. Evals: keep them honest, keep them cheap

The first Sonnet run scored 16/16 clubkit vs 15/16 baseline: no meaningful gap
on coding tasks, at about 20% more cost (`evals/RESULTS.md`). The one real
difference was a rule only the docs state. So the agent layer's value is
guardrails code can't show, and the evals that matter score workflow outcomes.

- [x] Read the first Sonnet run and write it up in `evals/RESULTS.md`.
- [ ] Workflow evals scored on outcomes: the fake outbox or adapter holds exactly the right messages,
      nothing is sent without approval, nothing is sent twice on a re-run.
- [ ] A few trap tasks where `AGENTS.md` rules are the test (a vague "just send them", a change that
      tempts editing an applied migration, a shared type outside `packages/schemas`). Run on Sonnet
      and Haiku with `--trials 3` and checks frozen. If there's still no gap, trim the agent layer to
      a short list of guardrails.
- [ ] Record the resolved model ID in results (the `sonnet` alias is all that's saved today).
- [ ] Run both sanity checks after every task change (noop passes 0, reference passes all).
- [ ] Later, if the trap tasks show a gap: `pnpm eval:report` with confidence intervals, ablations
      (no MCP, no `MODULE.md`, no `AGENTS.md`), tool-use traces, and an LLM-judge scope check.

## 9. Development

- [ ] **site-core:** decide the framework (QWeb uses React + Vite; QMIND uses Next.js), then extract
      layout, theme tokens, and the home/about/team/join pages.
- [ ] `pnpm clubkit new <name>`: scaffold a module that already passes validation.
- [ ] Detect a stale `catalog.json` in `pnpm validate`.
- [ ] MCP: expose module docs and skills as resources; add `scaffold_module` once the CLI command exists.
- [ ] MCP trust boundary: restrict `verify_module` to `pnpm vitest run modules/<name>` before the server
      is exposed beyond a local repo.

## 10. More clubs, and making it public

- [ ] A second club (Zac's) runs one workflow, set up by a non-technical exec. Two clubs is what
      shows it generalizes.
- [ ] Have an agent set up a club from scratch with only "set up announcements and recruitment for
      <club>"; turn every stall into a fix or an eval task.
- [ ] GitHub Actions: `pnpm check` plus both eval sanity checks on every push. Real agent evals stay manual.
- [ ] LICENSE (MIT), `CONTRIBUTING.md` from `docs/module-spec.md`.
- [ ] README for execs first: "QWeb runs on clubkit", a short demo of an exec approving an
      announcement in Discord, and the setup playbook. Developer docs second.
- [ ] Make the repository public once a real club runs a real workflow on it.

## Known issues

- Eval runs build from committed `HEAD` only; uncommitted changes are ignored (the runner warns).
- On Windows, `git worktree remove` fails on pnpm's long `node_modules` paths; the runner falls back to
  deleting the folder and pruning, which works.
- Baseline restores guidance files before checks, so a baseline agent's edits to `MODULE.md` or
  `AGENTS.md` are overwritten. Scoring is unaffected because checks test behaviour, not docs.
- The eval workspace deletes `packages/evals`, so `pnpm install` rewrites `pnpm-lock.yaml` there;
  scope checks ignore it.
