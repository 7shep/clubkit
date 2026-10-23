# clubkit

An agent-first monorepo of composable building blocks for running a student club.

Each module (events, applications, roster, …) describes itself in a
machine-readable manifest, shares typed data contracts, and ships a command
that proves it works. An AI agent can find the parts it needs, use them without
reading the whole repo, and check its own work.

## Layout

```
catalog.json          generated index of modules: agents read this first
modules/              one folder per capability (module.json + MODULE.md + src)
packages/schemas      shared Zod contracts: Member, Event, Application, Sponsor, manifests
packages/catalog      loads, validates, and verifies modules
packages/cli          `pnpm clubkit` commands
packages/mcp          MCP server exposing the catalog, docs, skills, and verify
packages/evals        eval runner: isolated worktrees, agents, hidden tests, scoring
skills/               step-by-step playbooks for club tasks
evals/                tasks, hidden tests, and reference solutions for agent evals
docs/module-spec.md   the module contract
```

## Modules

| Module | Status |
|---|---|
| events | experimental |
| applications | experimental |
| site-core, roster, sponsors | planned |

## Commands

```sh
pnpm install
pnpm clubkit list      # modules and status
pnpm catalog           # validate manifests and regenerate catalog.json
pnpm verify [module]   # run module verify commands
pnpm check             # typecheck + validate + tests
pnpm mcp               # start the MCP server on stdio
pnpm eval --help       # measure agent success with and without clubkit's agent layer
```

## Evals

`pnpm eval` gives Claude Code real club tasks in throwaway worktrees and scores
the results with hidden tests, once with the full repo and once with the
agent-facing layer removed. See [evals/README.md](evals/README.md).

`.mcp.json` registers the server for MCP clients opened in this folder, such as
Claude Code. Tools: `list_modules`, `get_module`, `verify_module`,
`list_skills`, `read_skill`.

## Origins

The first modules generalize patterns from the Queen's Web Development Club and
QMIND websites.
