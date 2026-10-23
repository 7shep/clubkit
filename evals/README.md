# Agent evals

These tasks measure how well an AI agent can use clubkit. The headline number is
**task success rate on the `clubkit` variant versus the `baseline` variant**:

| Variant | What the agent gets |
|---|---|
| `clubkit` | The full repo: `AGENTS.md`, `CLAUDE.md`, the MCP server, `skills/`, `docs/`, `catalog.json`, every `MODULE.md` |
| `baseline` | The same code with all of that removed |

The gap between the two is the value of the agent-facing layer.

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
   `evals/` is deleted (it holds the answers), and for `baseline` the guidance
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
| `tasks/<id>.json` | `id`, `prompt` (all the agent sees), `modules` (for analysis), `checks` |
| `hidden/<id>.eval.ts` | Vitest tests the agent never sees. Import modules with `../modules/...` paths |
| `reference/<id>.patch` | A known-good solution, as `git diff` output against `HEAD` |

Write prompts the way a club exec would ask. Name an API only when the hidden
tests depend on it. Then run both sanity checks.
