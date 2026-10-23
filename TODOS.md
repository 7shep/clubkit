# TODOS

What stands between clubkit today and the finished project: one monorepo with
everything a student club needs, built so AI agents can find, use, and verify
the parts they need, with evals that prove the agent-facing layer helps.

**Where it stands (2026-10-22):** two working modules (`events`,
`applications`), three planned (`site-core`, `roster`, `sponsors`), a manifest
validator and CLI, an MCP server, two playbooks, and an eval runner with three
tasks. Sanity checks pass (noop 0/6, reference 6/6), and one Claude Code
smoke test passed. No real clubkit-versus-baseline comparison has been run yet.

Work roughly top to bottom: each section makes the ones after it worth more.

## 1. Get a real eval result

The headline claim is "agents succeed more often with clubkit's agent layer
than without it." Nothing supports that yet.

- [ ] Grow the task set to 12–15 tasks. Three tasks cannot support a success
      rate. Mix sizes and modules; candidates:
  - [ ] Events: add RSVP storage with a cap that refuses sign-ups once full.
  - [ ] Events: recurring weekly events (e.g. "every Thursday until Dec 4").
  - [ ] Events: list upcoming events for a site that only has a timezone and the current instant.
  - [ ] Applications: reviewer scores with an average per applicant.
  - [ ] Applications: reopen a closed position without losing past decisions.
  - [ ] Applications: export accepted applicants as CSV, with no demographic fields.
  - [ ] Roster: promote the module, with a `Member` table that keeps emails private.
  - [ ] Roster: exec handoff that moves a role from one member to another and records the date.
  - [ ] Cross-module: an event page that also lists the sponsors for that event.
  - [ ] Ambiguous prompt: one task phrased loosely, the way a non-technical exec would ask.
- [ ] Run sanity checks after every task change (`--agent noop` must pass 0, `--agent reference` must pass all).
- [ ] Run the comparison: `pnpm eval --model sonnet --trials 3`, then repeat with a second model.
- [ ] Add `pnpm eval:report`: aggregate `evals/results/*.json` into success rate per variant and model,
      with confidence intervals, mean cost, turns, and duration, plus per-task breakdowns.
- [ ] Ablations: variants that remove only the MCP server, only `MODULE.md`, or only `AGENTS.md`,
      to show which part of the agent layer actually matters.
- [ ] Record which files and MCP tools each agent used (from `--output-format stream-json`), so
      results explain *why* a variant wins, not just that it does.
- [ ] Write up the results in `evals/RESULTS.md` with the exact commands, commit, models, and costs.

## 2. Finish the modules

- [ ] **sponsors:** promote from `planned` (the eval reference patch is a working starting point).
- [ ] **roster:** members, roles, terms, and exec handoff. Extract from QWeb's `team_members`.
- [ ] **site-core:** decide the framework first (QWeb uses React + Vite; QMIND uses Next.js), then
      extract layout, theme tokens, and the home/about/team/join pages.
- [ ] **events gaps:** RSVP storage, reminders, recurring events. Emit a `VTIMEZONE` block in `.ics`
      files; `TZID` without one works in most calendar apps but is not strictly valid iCalendar.
- [ ] **applications gaps:** form rendering from a prompt config, reviewer scoring, decision emails.
- [ ] New modules a club actually runs on: `forms`, `newsletter`/email, `budget`, `onboarding`, `projects`
      (member project showcase, from QWeb), and `handoff` (what next year's exec needs to know).

## 3. Strengthen the agent layer

- [ ] `pnpm clubkit new <name>`: scaffold a module that already passes validation, so agents and
      humans start from the convention instead of copying a folder.
- [ ] Detect a stale `catalog.json` in `pnpm validate` (regenerate in memory and compare).
- [ ] MCP: expose module docs and skills as MCP resources, and add a `scaffold_module` tool once the
      CLI command exists. Keep writes to the agent's own file tools.
- [ ] MCP trust boundary: `verify_module` runs the shell command in a manifest. Fine locally; restrict
      it to `pnpm vitest run modules/<name>` before the server is ever exposed beyond a local repo.
- [ ] More playbooks in `skills/`: start a new club site, run an event, hand off to next year's exec.
- [ ] Per-club configuration: one `club.config.json` (name, timezone, positions, branding) that
      module `config` fields read from, validated against the manifests.

## 4. Use it for a real club

- [ ] Supabase setup guide: applying module migrations in order, environment variables, and an `.env.example`.
- [ ] Stand up one real club from clubkit end to end (a small Queen's club, or a QWeb/QMIND rebuild).
      A real user is worth more than any number of planned modules.
- [ ] Have an agent do it: give Claude Code only "set up a site and recruitment for <club>" and record
      what it got right and where it stalled. Turn every stall into a doc fix or an eval task.

## 5. Make it presentable

- [ ] GitHub Actions: `pnpm check` plus both eval sanity checks on every push. The real agent eval stays
      manual because it costs money.
- [ ] Add a LICENSE (MIT, to match making it public).
- [ ] Make the repository public once the README shows a real eval result.
- [ ] README: a short demo (GIF or video) of an agent using the MCP server, and the headline eval chart.
- [ ] `CONTRIBUTING.md` built from `docs/module-spec.md`, for other club developers.

## Known issues

- Eval runs build from committed `HEAD` only; uncommitted changes are ignored (the runner warns).
- On Windows, `git worktree remove` fails on pnpm's long `node_modules` paths; the runner falls back to
  deleting the folder and pruning, which works.
- Baseline restores guidance files before checks, so a baseline agent's edits to `MODULE.md` or
  `AGENTS.md` are overwritten. Scoring is unaffected because checks test behaviour, not docs.
