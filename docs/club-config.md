# Club config

One club's settings live in `club.config.json` at the repo root. The shape is
`ClubConfigSchema` in `packages/schemas`. Execs shouldn't edit it by hand: an
agent asks them the questions below and writes the file. Start from
`club.config.example.json`, a fictional club.

Check it with:

```sh
pnpm clubkit config check                    # club.config.json
pnpm clubkit config check --config <file>    # any other file
```

Every problem names the field and what's allowed. Fix them and re-run until it
prints ✓.

## Fields

| Field | Ask the execs | Notes |
|---|---|---|
| `name`, `shortName` | What's the club called, and what do members call it? | |
| `timezone` | Which timezone are event times in? | IANA name, e.g. `America/Toronto` |
| `websiteUrl` | Does the club have a website? | Optional |
| `approvers` | Who can approve messages before they go out? | At least one. `name` is required; `role`, `discordId`, `slackId` are optional |
| `channels` | Where do announcements go, and where should execs review drafts? | Named channels, each `{ platform, id, name? }`. Workflows use `announcements` and `approvals` |
| `positions` | Which roles can people apply for? | |
| `templates` | How should these messages read? | Named `{ subject, body }` with `{{field}}` placeholders. `close-recruitment` uses `decision-accepted` and `decision-rejected` |
| `branding` | Brand colour and logo? | `primaryColor` as `#rrggbb`, `logoPath` |
| `modules` | Settings for a specific module | `modules.<name>.<key>`, checked against that module's `module.json` `config` |

Unknown fields are rejected, so a typo is caught rather than silently ignored.

## How modules read it

For each key in a module manifest's `config`, the value is the first of:

1. `modules.<name>.<key>` in the club config,
2. a top-level club field with the same name and type (so `timezone` reaches `events`),
3. the manifest's `default`.

`config check` reports unknown modules, unknown keys, wrong types, and required
keys that resolve to nothing. In code: `loadClubConfig`, `moduleConfig`, and
`findApprover` from `@clubkit/catalog`.

## What reads it today

- `pnpm clubkit close-recruitment` takes its templates from the config when
  `--templates` is not given.
- `pnpm clubkit outbox approve --by <name>` refuses anyone not in `approvers`,
  and records the approver's name as the config spells it.

Both read `club.config.json` when it exists, or the file given with `--config`.

## Privacy

`club.config.json` is gitignored in this repository: it's one club's settings,
not part of the framework. Don't put tokens or keys in it; those go in `.env`.
List approvers by name and platform id only, never personal email addresses.
