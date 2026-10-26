# Integration spec

An integration is how clubkit reaches the world: email, Discord, Slack,
calendars, social platforms. Workflows never call a provider directly. They
receive an adapter, so the same workflow runs against the real provider, a fake
in tests and evals, or a dry run an exec can read before anything goes out.

## The contract

Shapes live in `packages/schemas` (`src/integrations.ts`):

```ts
type IntegrationMode = "live" | "fake" | "dry-run";

interface Adapter<T extends { key: string }> {
  readonly integration: string;   // "email", "discord", ...
  readonly mode: IntegrationMode;
  send(message: T): Promise<{ id: string }>;
}

type EmailAdapter = Adapter<OutgoingEmail>;
```

| Mode | Delivers? | Outbox afterwards | For |
|---|---|---|---|
| `live` | Yes, through the provider | `sent`, with the provider's id | Real use |
| `fake` | Recorded in memory or a file | `sent` | Tests, evals, and CLI runs before a provider is set up |
| `dry-run` | Recorded only | Unchanged: still `approved` | Showing an exec exactly what would go out |

## Rules for every adapter

1. **Pass the idempotency key.** `message.key` is the outbox key. A live adapter
   sends it as the provider's idempotency key wherever the provider has one, so
   a crash between "provider accepted it" and "outbox saved it" can't produce a
   second delivery. Where a provider has none, say so in the integration's docs.
2. **Throw on failure.** `sendApproved` stops at the first throw and keeps what
   was sent, so a re-run finishes the rest. Never swallow an error and return a
   made-up id.
3. **Credentials come from `.env`, never the club config or a commit.** Read them
   with `requireEnv(integration, names, { guide })` from `@clubkit/integrations`.
   It names every missing variable and points to a setup guide written for a
   non-technical exec. It never prints a value, and neither should the adapter.
4. **Every integration ships a fake.** Build it with `createRecorder(integration,
   "fake")`, which also takes `failOn` to simulate provider failures. Its dry run
   is `createRecorder(integration, "dry-run")`.
5. **Destinations come from the club config.** An adapter takes channel ids and
   similar settings from `club.config.json` (`channels`), not hard-coded values.

## Helpers (`@clubkit/integrations`)

| Function | Does |
|---|---|
| `createRecorder(integration, mode, { failOn? })` | In-memory fake or dry-run adapter; `delivered` lists what it received |
| `createFileRecorder(integration, path)` | Fake adapter that appends each delivery to a JSON file, for CLI runs |
| `requireEnv(integration, names, { env?, guide? })` | Returns the named credentials, or throws naming the missing ones |

## Layout

Shared helpers live in `packages/integrations`. Each real integration will live
in `integrations/<name>` as a workspace package (`@clubkit/integration-<name>`)
with a `createLive...` factory, its fake, tests run against the fake, and a setup
guide. None exists yet: email has its contract and fake (`createFakeEmail` in
`modules/outbox`), and Discord is next.

## In the CLI

`pnpm clubkit outbox send` takes `--dry-run` (preview, changes nothing) or
`--fake <file>` (deliver to a file and mark sent). With no email provider set
up, it refuses to run without one of them.
