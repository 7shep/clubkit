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
skills/               step-by-step playbooks for club tasks
evals/                tasks for measuring how well agents use the repo
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
```

`.mcp.json` registers the server for MCP clients opened in this folder, such as
Claude Code. Tools: `list_modules`, `get_module`, `verify_module`,
`list_skills`, `read_skill`.

## Origins

The first modules generalize patterns from the Queen's Web Development Club and
QMIND websites.
