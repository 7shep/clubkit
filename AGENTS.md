# Working in clubkit (for agents)

clubkit is built to be used by agents. Find what you need instead of reading everything.

1. **Discover:** read `catalog.json` (or call the MCP tool `list_modules`). Pick
   modules by their `useWhen` lists.
2. **Learn one module:** read its `module.json` and `MODULE.md`. Treat
   `provides.exports` as the public API.
3. **Follow a playbook** in `skills/` when the task matches one.
4. **Verify:** `pnpm verify <module>` after changing a module, and `pnpm check`
   before finishing. Do not report success unless these pass.

## Conventions

- Shared data shapes live only in `packages/schemas`. See `docs/module-spec.md`.
- `catalog.json` is generated; run `pnpm catalog` after editing any manifest.
- Modules with `status: "planned"` are docs only. Do not import them.
- Never commit real member or applicant data, Supabase keys, or `.env` files.
- TypeScript, ESM, pnpm workspaces, Vitest. No build step: packages export `src/` directly.
