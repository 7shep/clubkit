# TODOS

**The goal:** a system that runs the tedious parts of a student club. The
monorepo is the framework for how a club works, written so an agent can see
what the club does and help with it: sending acceptance and rejection emails,
scheduling interviews, handing off roles to new execs, onboarding, outreach,
marketing, sponsors, and development when it's needed.

## The system

| Layer | What it is | Where it lives | Today |
|---|---|---|---|
| **Modules** | What the club's data is and the rules it follows | `modules/<name>` | `events`, `applications` work; `roster`, `sponsors`, `site-core` planned |
| **Integrations** | How clubkit touches the world: email, calendar, Supabase, social | `integrations/<name>` | None |
| **Workflows** | What an agent runs end to end: "close recruitment", "hand off VP Events" | `skills/` + workflow functions | Two playbooks, no automation |
| **Club config** | One club's name, timezone, positions, templates, approvers, branding | `club.config.json` | None |

Every workflow follows the same shape: **work out what's needed → draft →
exec approves → do it → record it.** Anything that reaches a real person (an
applicant, a sponsor, the public) is drafted first and sent only after a human
approves, and every send is logged so a re-run never repeats it. That rule is
what makes it safe to hand an agent the club's inbox.

**Where it stands (2026-10-22):** two working modules, an MCP server, a CLI
and manifest validator, two playbooks, and an eval runner with 16 tasks
(sanity: noop 0/32, reference 32/32). The first Sonnet run scored 16/16
clubkit vs 15/16 baseline: no meaningful gap yet (`evals/RESULTS.md`). No integrations, workflows, or club config yet. No club
runs on it yet; QWeb is the first target.

Work top to bottom. Each step is ordered by tedium × frequency × what's coming up
in the club year.

## 1. Prove the agent layer helps

The claim: agents succeed more often with clubkit's agent layer than without it.

- [x] Read the first Sonnet run (`evals/RESULTS.md`): 16/16 clubkit vs 15/16 baseline after fixing
      over-strict checks. No meaningful gap yet; Sonnet nearly saturates the task set.
- [ ] Harder, less specified tasks where the conventions in `MODULE.md` and `AGENTS.md` are the trap,
      so the task set can separate the variants.
- [ ] Rerun with `--trials 3` and checks frozen, on Sonnet and a weaker model (Haiku).
- [ ] Record the resolved model ID in results (the `sonnet` alias is all that's saved today).
- [x] Write up the results in `evals/RESULTS.md`: exact commands, commit, models, costs, per-task results.
- [ ] `pnpm eval:report`: aggregate `evals/results/*.json` into success rate per variant and model,
      with confidence intervals, mean cost, turns, and duration, plus per-task breakdowns.
- [ ] Ablations: variants that remove only the MCP server, only `MODULE.md`, or only `AGENTS.md`.
- [ ] Record which files and MCP tools each agent used (`--output-format stream-json`), so results
      explain *why* a variant wins.
- [ ] Scope quality beyond structure: an LLM-judge check alongside `evals/hidden/support/scope.ts`.
- [ ] Run both sanity checks after every task change (noop passes 0, reference passes all).

## 2. Foundations every workflow needs

- [ ] **Club config:** `club.config.json` (name, timezone, positions, email templates, approvers,
      branding), validated against module manifests. Module `config` fields read from it.
- [ ] **Integration contract:** each integration is an injected adapter with a real implementation,
      a fake for tests, and a dry-run mode. Shapes live in `packages/schemas` like everything else.
- [ ] **Email integration:** send through one provider (decide which with QWeb). The `EmailAdapter`
      contract and a fake (`createFakeEmail`, `outbox send --fake`) exist in `modules/outbox`; a real
      adapter must pass the message `key` as the provider's idempotency key.
- [ ] **Calendar integration:** free/busy and invites (Google Calendar first; it's what execs use).
- [x] **Outbox and approvals:** `modules/outbox`: `draft → approved → sent`, who approved and when,
      one message per idempotency key. CLI: `pnpm clubkit outbox list|approve|send`.
- [ ] **Audit log:** every action a workflow takes, readable by execs, with no personal data in public places.
- [ ] Supabase setup guide: applying migrations in order, environment variables, and an `.env.example`.

## 3. Recruitment, end to end, at QWeb

The most tedious and most visible job, and the first real production use.

- [x] **Decision emails:** `decisionEmails` in applications and `pnpm clubkit close-recruitment`:
      one draft per accepted or rejected applicant, keyed `decision:<id>`; withdrawn and undecided get none.
      Eval: `close-recruitment`.
- [ ] **Interview scheduling:** offer slots from interviewers' calendars, let applicants pick, send
      invites, and move applicants to `interview` through `transition`.
- [ ] **Reviewer scoring:** scores per reviewer with averages (the `applications-reviewer-scores`
      eval reference is a working start).
- [ ] **Application form** rendered from the club's prompt config.
- [x] Playbook: `skills/close-recruitment.md` (decide → draft emails → approve → send → report counts).
- [ ] Run QWeb's next recruitment cycle on it. Record every place the agent stalled and turn each into
      a doc fix or an eval task.

## 4. Handoff and onboarding

Exec turnover happens in spring; have this ready before then.

- [ ] **roster:** promote it (the `roster-promote` and `roster-exec-handoff` eval references are a start).
      Extract from QWeb's `team_members`. Public team page, private emails.
- [ ] **handoff module:** per-role docs, access lists (accounts, drives, keys to rotate), open tasks,
      and "what you need to know" notes. The agent drafts them from the outgoing exec's input.
- [ ] **onboarding module:** a checklist per role or for new members (accounts, intro email, first
      tasks), driven by `acceptedApplicantsCsv`-style handoff from recruitment.
- [ ] Playbooks: `skills/hand-off-a-role.md` and `skills/onboard-new-members.md`.
- [ ] Workflow evals: given a roster and a role, the handoff doc covers access, open work, and contacts.

## 5. Sponsors and outreach

- [ ] **sponsors:** promote it (the `promote-sponsors` eval reference is a start). Tiers and logos on the site.
- [ ] **Outreach pipeline:** who was contacted, when, by whom, and what they said; follow-up reminders.
- [ ] The agent drafts outreach and follow-ups from the club's sponsorship package; execs approve and send.
- [ ] Playbook: `skills/run-sponsor-outreach.md`.

## 6. Events and marketing

- [ ] **events gaps:** RSVP storage, reminders, recurring events (eval references exist for the first
      and last). Emit `VTIMEZONE` in `.ics` files.
- [ ] **Marketing drafts:** event posts and a newsletter generated from events data, approved before posting.
- [ ] Social integrations, one platform at a time, starting with the one QWeb uses most.
- [ ] Playbook: `skills/run-an-event.md` (create → announce → RSVPs → reminders → follow-up).

## 7. Development

Agents are already good at this; it's what the current evals measure.

- [ ] **site-core:** decide the framework (QWeb uses React + Vite; QMIND uses Next.js), then extract
      layout, theme tokens, and the home/about/team/join pages.
- [ ] `pnpm clubkit new <name>`: scaffold a module that already passes validation.
- [ ] Detect a stale `catalog.json` in `pnpm validate`.
- [ ] MCP: expose module docs and skills as resources; add `scaffold_module` once the CLI command exists.
- [ ] MCP trust boundary: restrict `verify_module` to `pnpm vitest run modules/<name>` before the server
      is exposed beyond a local repo.

## 8. More clubs, and making it public

- [ ] A second club (Zac's) tries one workflow. Two clubs is what shows it generalizes.
- [ ] Have an agent set up a club from scratch with only "set up a site and recruitment for <club>";
      turn every stall into a fix or an eval task.
- [ ] Workflow evals: tasks scored on outcomes (e.g. the fake outbox holds exactly the right emails,
      nothing sent without approval, nothing sent twice on a re-run), not just function behaviour.
- [ ] GitHub Actions: `pnpm check` plus both eval sanity checks on every push. Real agent evals stay manual.
- [ ] LICENSE (MIT), `CONTRIBUTING.md` from `docs/module-spec.md`.
- [ ] README: the headline eval chart, "QWeb runs on clubkit", and a short demo of an agent running a workflow.
- [ ] Make the repository public once the README shows a real eval result and a real club.

## Known issues

- Eval runs build from committed `HEAD` only; uncommitted changes are ignored (the runner warns).
- On Windows, `git worktree remove` fails on pnpm's long `node_modules` paths; the runner falls back to
  deleting the folder and pruning, which works.
- Baseline restores guidance files before checks, so a baseline agent's edits to `MODULE.md` or
  `AGENTS.md` are overwritten. Scoring is unaffected because checks test behaviour, not docs.
- The eval workspace deletes `packages/evals`, so `pnpm install` rewrites `pnpm-lock.yaml` there;
  scope checks ignore it.
