# Module spec

A module is a folder in `modules/` that an agent can understand from two files
without reading its code:

| File | For | Contains |
|---|---|---|
| `module.json` | machines | The manifest below, validated by `ModuleManifestSchema` in `packages/schemas` |
| `MODULE.md` | agents and humans | When to use it, its contract, rules, and what it does not do yet |

Experimental and stable modules also have `package.json` (`@clubkit/<name>`),
`src/` with tests, and optionally `migrations/` for Supabase SQL.

## Manifest fields

| Field | Meaning |
|---|---|
| `name` | Kebab-case, identical to the folder name |
| `version` | Semver. `0.0.0` for planned modules |
| `status` | `planned` (docs only), `experimental` (works, API may change), `stable` |
| `summary` | One sentence, 10–200 characters, shown in `catalog.json` |
| `useWhen` | Concrete tasks that should lead an agent here. This is the module's search surface |
| `provides.schemas` | Names from `sharedSchemas` the module reads or writes |
| `provides.exports` | Public functions. Anything else in `src/` is internal |
| `provides.migrations` | SQL files, relative to the module, in apply order |
| `requires` | Other module names that must be present |
| `config` | Per-club settings with type, description, and optional default |
| `verify` | Command run from the repo root that exits 0 when the module works. Required unless `planned` |
| `docs` | Usage guide filename, default `MODULE.md` |

## Rules

1. **Contracts live in `packages/schemas`.** A module never defines its own
   version of a shared shape; add or extend the shared schema instead.
2. **Fail with instructions.** Errors should name what was expected and what is
   allowed (see `transition` in `applications`), so an agent can self-correct.
3. **Verification is mandatory.** A module is not done until `pnpm verify <name>`
   passes, and `pnpm catalog` reports no problems.
4. **Private data stays private.** Tables with personal data get RLS with no
   public policies; real member or applicant data is never committed.
5. **`catalog.json` is generated.** Run `pnpm catalog` after any manifest change.
