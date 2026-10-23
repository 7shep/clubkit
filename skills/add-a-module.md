# Add or promote a module

Use this when building a new module or turning a `planned` module into a working one.

1. Read `docs/module-spec.md` and one working module (`modules/events`) as a reference.
2. If the module stores a new kind of data, add its Zod schema to
   `packages/schemas/src/club.ts` and register it in `sharedSchemas`.
3. Create or update `modules/<name>/`:
   - `module.json` with an honest `status` and every public export listed.
   - `package.json` named `@clubkit/<name>` that depends on `@clubkit/schemas`.
   - `src/index.ts` and `src/<name>.test.ts`.
   - `migrations/0001_<name>.sql` if it needs storage. Enable RLS.
   - `MODULE.md` covering use cases, contract, rules for agents, and gaps.
4. Set `verify` to `pnpm vitest run modules/<name>`.
5. Run `pnpm install`, `pnpm verify <name>`, then `pnpm catalog`.
6. Done means: verify passes, the catalog has no problems, and `pnpm typecheck` is clean.
