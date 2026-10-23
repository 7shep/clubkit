# Agent evals

These tasks measure how well an AI agent can use clubkit. The headline number is
**task success rate on the `clubkit` variant versus the `baseline` variant**:

| Variant | What the agent gets |
|---|---|
| `clubkit` | The full repo: `AGENTS.md`, `CLAUDE.md`, the MCP server, `skills/`, `docs/`, `catalog.json`, every `MODULE.md` |
| `baseline` | The same code with all of that removed |

The gap between the two is the value of the agent-facing layer. Results so far
are in [RESULTS.md](RESULTS.md).

## Tasks

| Task | Modules | Kind |
|---|---|---|
| `applications-waitlist` | applications | Feature: new status through schema, pipeline, and database |
| `applications-reviewer-scores` | applications | Feature: shared schema, private table, averaging |
| `applications-reopen-position` | applications | Feature: hiring rounds without losing past decisions |
| `applications-accepted-csv` | applications | Feature: CSV export that leaks nothing personal |
| `applications-position-typos` | applications | Bug, loosely worded the way a non-technical exec would ask |
| `events-multiday-hackathon` | events | Bug: multi-day `.ics` end dates |
| `events-rsvp-storage` | events | Feature: RSVP storage with a cap, private table |
| `events-recurring-weekly` | events | Feature: weekly series across DST and year end |
| `events-upcoming-timezone` | events | Feature: "today" from an instant and a timezone |
| `promote-sponsors` | sponsors | Promote a planned module |
| `roster-promote` | roster | Promote a planned module; public team page, private emails |
| `roster-exec-handoff` | roster | Promote, then add exec handoff with a dated record |
| `event-page-sponsors` | events, sponsors | Cross-module: schema change in one, new export in the other |
| `scope-rsvp-reminders` | events | Hand out work: write a scope, don't build |
| `scope-decision-emails` | applications | Hand out work: write a scope, don't build |
| `scope-sponsor-page` | sponsors | Hand out work, loosely worded |

### Hard tasks

The first Sonnet run passed nearly every task above in both variants
([RESULTS.md](RESULTS.md)): most prompts name the exact API and every
requirement, so the baseline doesn't need the guidance. The tasks tagged
`hard` leave out what a club exec wouldn't say, and hide a trap that the
code or the guidance would warn about.

| Task | The trap | Where the warning lives |
|---|---|---|
| `applications-no-show` | Editing the applied migration instead of adding one | Guidance (append-only migrations) |
| `newsletter-signup` | Defining the shape in the module; anon-readable subscribers | Guidance (contracts, private data) |
| `events-next-on-homepage` | Taking "today" from the UTC server clock | Code (`config.timezone`) and guidance |
| `roster-team-page` | Emails on a public page; importing a planned module | Code (`Member.email`, `status`) and guidance |
| `events-check-in` | Same traps as RSVP storage, with the hints removed from the prompt | Code and guidance |
| `recruitment-wrapup` | Naming applicants in a public channel; not flagging undecided ones | Guidance (`skills/run-recruitment.md`) |
| `recruitment-decisions` | Forcing illegal status changes (un-withdrawing, reversing a rejection) | Code (`transition`) and guidance |

Each task's `tags` say where the information it needs lives: `needs:code` means
a careful agent can find it in the code alone, and `needs:guidance` means
clubkit's agent layer states it. Report results per tag, so a gap on
guidance-only tasks is read for what it is: the value of writing the club's
rules down, not a property of the code.

Workflow tasks (`workflow` tag) start from fixture data: `fixtures` in the task
file maps workspace paths to files in `fixtures/`, committed into the workspace
before the agent starts. All fixture people and emails are invented.

### Hand-out-work tasks

`scope-*` tasks ask the agent to write a scope for someone else at
`scopes/<name>.md` instead of building the feature. `hidden/support/scope.ts`
checks every scope the same way:

- Only the scope file changed: the agent delegated, it didn't build.
- 200–2000 words, a title, and no placeholders.
- Sections for the goal or background, what to build, out of scope, acceptance
  criteria (at least 3 items), and open questions or assumptions.
- It names the right `modules/<name>`, every module or package it names
  exists, and it says which verify command proves the work.
- Task-specific facts: the requirements from the ask (e.g. "never twice") and
  the repo constraints a newcomer would trip on (e.g. RSVPs aren't stored yet,
  applicant data is service-role only).

These are structural checks, so they catch a scope that is missing something,
not one that is badly written.

## Running

```sh
pnpm eval --agent noop --variant clubkit       # sanity: must pass 0 tasks
pnpm eval --agent reference --variant clubkit  # sanity: must pass every task
pnpm eval --model sonnet                       # real run: both variants with Claude Code
pnpm eval --task promote-sponsors --trials 3 --keep
```

Run the two sanity checks after adding or changing a task. If `noop` passes a
task, the task measures nothing; if `reference` fails one, its checks are broken.

## How an attempt works

1. A detached git worktree of `HEAD` is created in the system temp folder.
   `evals/` and `packages/evals/` are deleted (they hold the answers), and for `baseline` the guidance
   files too. The deletion is committed so the agent sees a clean tree.
2. `pnpm install`, then the agent gets only the task's `prompt`.
3. Baseline guidance is restored (manifest checks need `MODULE.md`), and the
   task's hidden tests are copied to `eval-hidden/<task>.test.ts`.
4. The task's `checks` run. The attempt passes only if every check exits 0.
5. The worktree is removed unless `--keep` is given.

Only committed code is evaluated. Results go to `evals/results/<run>.json`
(gitignored) with the agent, model, commit, cost, duration, and check output.

## The Claude Code agent

Runs `claude -p` headless in the workspace with `--permission-mode dontAsk` and
an allowlist: file tools, `pnpm`, read-only `git`, and the clubkit MCP tools.
User settings and other MCP servers are not loaded, and `--max-budget` caps
spend per attempt (default $2). It uses your existing Claude Code login.

## Adding a task

Each task needs three files sharing one id:

| File | Contains |
|---|---|
| `tasks/<id>.json` | `id`, `prompt` (all the agent sees), `modules` and `tags` (for analysis), `checks`, optional `fixtures` |
| `hidden/<id>.eval.ts` | Vitest tests the agent never sees. Import modules with `../modules/...` paths |
| `reference/<id>.patch` | A known-good solution, as `git diff` output against `HEAD` |

Helpers shared by hidden tests go in `hidden/support/`. They are copied to
`eval-hidden/support/`, so import them as `./support/<file>`.

Write prompts the way a club exec would ask. Name an API only when the hidden
tests depend on it. Then run both sanity checks.
