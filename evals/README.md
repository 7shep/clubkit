# Agent evals

These tasks measure how well an AI agent can use clubkit. The headline number is
**task success rate**: run the same tasks against clubkit and against a baseline
(the same code without manifests, catalog, skills, or MCP) and compare.

## Task format

Each `tasks/*.json` file has:

| Field | Meaning |
|---|---|
| `id` | Stable identifier |
| `prompt` | Exactly what the agent is told |
| `modules` | Modules a correct solution should touch (for analysis, not shown to the agent) |
| `checks` | Commands run from the repo root after the agent finishes; all must exit 0 |

Scoring is pass/fail per task. Record the agent, model, date, and clubkit commit
with every run so results are reproducible.

## Status

Task definitions only. The runner (fresh worktree per task → agent → checks →
`evals/results/`) is the next piece to build.
