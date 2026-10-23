# Eval results

The question these evals answer: **do agents succeed more often with clubkit's
agent layer (`AGENTS.md`, `CLAUDE.md`, the MCP server, `skills/`, `docs/`,
`catalog.json`, `MODULE.md` files) than with the same code without it?** How the
runner works is in [README.md](README.md).

## Summary (2026-10-22, Sonnet, 1 trial per task)

| | clubkit | baseline |
|---|---|---|
| Tasks passed, current checks | **16/16** | **15/16** |
| Tasks passed, as first scored | 12/16 | 11/16 |
| Cost, 16 attempts | $2.30 | $1.93 |
| Mean time per attempt | 45 s | 40 s |
| Mean turns per attempt | 17.0 | 13.4 |

**What this shows so far:**

- **No meaningful success gap yet.** One task in sixteen separates the versions
  (`events-recurring-weekly`), from a single trial. That is within noise.
- **Sonnet nearly saturates this task set.** With the corrected checks, every
  real agent failure left is one task in one version. The tasks are too easy, or
  too fully specified by their prompts, to show what the agent layer is worth.
- **The agent layer costs more.** With it, Sonnet took about 27% more turns,
  spent 19% more, and ran 12% longer: it reads the guidance before working.
  Until success rates separate, that's pure overhead.
- **Where it did help, it was conventions.** The one baseline failure was a
  new function missing from `module.json`'s `provides.exports`, a rule that
  `AGENTS.md` and `MODULE.md` state and the code does not.

This is not yet a result to quote. See [What's next](#whats-next).

## Runs

| Run | Commit | Agent | Tasks | Variants | Cost |
|---|---|---|---|---|---|
| `2026-10-23T02-31-43-471Z-claude` | `051e34d` | claude, `--model sonnet` | all 16 | both | $4.23 |
| `2026-10-23T03-02-14-299Z-claude` | `1f6afed` | claude, `--model sonnet` | 4 rerun after check fixes | both | $1.28 |
| sanity: noop | `051e34d` | noop | all 16 | both | 0/32 passed (expected 0) |
| sanity: reference | `051e34d`, scope tasks again at `6b6483f`* | reference | all 16 | both | 32/32 passed (expected all) |

\* The scope tasks' sanity checks were rerun after each checker fix: noop 0/6, reference 6/6.

Run JSON is in `evals/results/` (gitignored). Environment: Windows 11, Node
v24.19.0, Claude Code 2.1.309, default `--max-budget 2`. The model was passed as
the `sonnet` alias; the runner does not yet record which model version it resolved to.

Commands:

```sh
pnpm eval --model sonnet
pnpm eval --model sonnet --keep --task events-rsvp-storage --task scope-rsvp-reminders \
  --task scope-decision-emails --task scope-sponsor-page
```

## Per task (run 1, plus the rerun for the four tasks marked †)

| Task | clubkit | baseline | Time (s) c / b | Cost c / b | Turns c / b |
|---|---|---|---|---|---|
| applications-accepted-csv | ✓ | ✓ | 39 / 24 | $0.12 / $0.08 | 12 / 9 |
| applications-position-typos | ✓ | ✓ | 31 / 18 | $0.07 / $0.07 | 8 / 8 |
| applications-reopen-position | ✓ | ✓ | 41 / 29 | $0.16 / $0.10 | 24 / 11 |
| applications-reviewer-scores | ✓ | ✓ | 46 / 37 | $0.17 / $0.14 | 17 / 19 |
| applications-waitlist | ✓ | ✓ | 43 / 29 | $0.15 / $0.10 | 22 / 15 |
| event-page-sponsors | ✓ | ✓ | 45 / 37 | $0.17 / $0.15 | 23 / 25 |
| events-multiday-hackathon | ✓ | ✓ | 24 / 20 | $0.08 / $0.07 | 8 / 8 |
| events-recurring-weekly | ✓ | **✗** | 30 / 29 | $0.11 / $0.10 | 13 / 11 |
| events-rsvp-storage † | ✓ | ✓ | 48 / 34 | $0.17 / $0.14 | — |
| events-upcoming-timezone | ✓ | ✓ | 31 / 19 | $0.09 / $0.08 | 12 / 10 |
| promote-sponsors | ✓ | ✓ | 38 / 36 | $0.15 / $0.13 | 23 / 19 |
| roster-exec-handoff | ✓ | ✓ | 64 / 55 | $0.22 / $0.19 | 15 / 11 |
| roster-promote | ✓ | ✓ | 50 / 41 | $0.18 / $0.19 | 25 / 26 |
| scope-decision-emails † | ✓ | ✓ | 49 / 49 | $0.14 / $0.15 | — |
| scope-rsvp-reminders † | ✓ | ✓ | 64 / 54 | $0.20 / $0.17 | — |
| scope-sponsor-page † | ✓ | ✓ | 75 / 36 | $0.19 / $0.11 | — |

The summary's cost, time, and turn figures use run 1 only, so both versions are
compared on the same 16 attempts.

## Failures, and which were the checks' fault

Run 1 failed 9 of 32 attempts. Only one was a real agent mistake.

| Attempt | Cause | Verdict |
|---|---|---|
| `events-recurring-weekly` baseline | Didn't add `weeklyOccurrences` to `module.json` exports | **Agent.** Fair fail |
| `events-rsvp-storage` clubkit | Counted every RSVP in `existing` toward the cap, including other events' | **Task.** The hidden test required per-event counting, but the prompt never said so. Prompt fixed; passes on rerun |
| `events-rsvp-storage` baseline | Correct private table; a SQL comment said "never expose this table to anon" | **Check.** Matched a comment. Now strips comments and checks policies and grants per statement |
| All 6 scope attempts | Good scopes rejected on wording: "Done means" / "Done when", a summary under the title, "What exists today", "Part 1: build…", "Open items", naming `pnpm vitest run modules/<name>` instead of `pnpm verify <name>`, a proposed new module, a mention of `packages/evals` | **Check.** Heading patterns widened, any equivalent verify command accepted, new modules allowed when the line says so |

The first round of scope fixes contained its own bug: literal backspace
characters where `\b` belonged, so "Done when" still failed on the rerun. That
was fixed, and the six kept rerun workspaces were rescored with the final
checker; all six pass. Run 1's scope workspaces were not kept, so its scopes
couldn't be rescored.

**Caveat:** the checks were corrected after seeing agent output. Each fix
accepts something a reasonable scope says (a synonym heading, an equivalent
command), and the checker still rejects stubs, scopes missing a section,
invented modules, scopes that edit code, and scopes missing a key fact. But
loosening checks after a run is how evals get overfit, so the next run should be
scored with the checks frozen.

## Lessons for the eval itself

- **Run real agents before trusting a new check.** The sanity agents only prove
  the reference passes and doing nothing fails. They can't catch a check that
  rejects correct work written differently from the reference.
- **Keep workspaces on the first real run of new tasks** (`--keep`), so failures
  can be rescored instead of rerun.
- **Every hidden-test requirement must be in the prompt**, or the task measures
  mind-reading.

## Calibration: hard tasks on Haiku (2026-10-23)

Seven `hard` tasks were added with traps the code or the guidance warns about
(see [README.md](README.md#hard-tasks)). Before a paid run, Haiku ran them once
per variant with workspaces kept, to find checks that reject correct work.

Run `2026-10-23T04-04-31-551Z-claude`, commit `1548278`, `--model haiku`, $0.16:

| Task | clubkit | baseline | Why |
|---|---|---|---|
| applications-no-show | ✓ | ✓ | Both added a new migration instead of editing 0001 |
| newsletter-signup | ✗ | ✗ | **Task.** Neither stored subscribers; the prompt never asked for storage. Prompt fixed |
| events-next-on-homepage | ✓ | ✓ | Both used the club's timezone |
| roster-team-page | ✓ | **✗** | **Agent.** Baseline wrote `teamPage` but left roster `planned` |
| events-check-in | ✓ | ✓ | |
| recruitment-wrapup | ✓ | ✓ | Both posted counts only and flagged the 3 undecided |
| recruitment-decisions | ✓ | ✓ | Both refused the two illegal moves; baseline read the rule from the code |

Excluding the newsletter task: clubkit 6/6, baseline 5/6.

**The finding that matters:** even Haiku, without the agent layer, avoided most
traps by reading the code. Where a rule shows up in code (`transition`'s table,
`config.timezone`, a `status` field, an existing migration), today's models
find it. The agent layer helped where the step is a convention the code
doesn't announce: promoting a planned module properly.

So a substantial gap is unlikely from the docs layer alone on code tasks. It
should come from what code can't hold: the club's own context and processes
(who approves, what's been sent, which templates, the club's calendar), which
is the integrations and workflow layer in `TODOS.md`. Workflow evals against
that layer are where "the system helps" can be measured.

## What's next

1. **`--trials 3`, with checks frozen,** on Sonnet and Haiku over all 23 tasks,
   reported per tag (`needs:code` vs `needs:guidance`).
2. **Workflow evals once the workflow layer exists**: e.g. "close recruitment"
   against a fake outbox, scored on what was sent, approved, and never repeated.
3. **Record the resolved model ID and tool usage** (`--output-format stream-json`)
   in results, to see whether clubkit agents actually use the MCP server and docs.
4. **Ablations** once there is a gap to explain.
