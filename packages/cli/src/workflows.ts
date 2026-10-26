import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { decisionEmails, pipelineSummary } from "@clubkit/applications";
import { clubConfigPath, findApprover, loadClubConfig, loadModules } from "@clubkit/catalog";
import { createFileRecorder, createRecorder } from "@clubkit/integrations";
import { approve, draft, outboxSummary, sendApproved } from "@clubkit/outbox";
import {
  ApplicationSchema,
  type ClubConfig,
  EmailTemplateSchema,
  OutboxMessageSchema,
  type OutboxMessage,
  type OutgoingEmail,
} from "@clubkit/schemas";
import { z } from "zod";

// Workflow commands. Each follows the same shape: work out what's needed, draft,
// an exec approves, send, report counts. Output names no applicants, so it can be pasted anywhere.

export const workflowUsage = `  config check [--config <file>]
                    Check the club config against the module manifests
  close-recruitment --applications <file> --outbox <file> [--templates <file>]
                    Draft one decision email per accepted or rejected applicant. Sends nothing.
                    Templates default to the club config's decision-accepted and decision-rejected
  outbox list --outbox <file> [--status draft|approved|sent]
                    Show messages in full, for an exec to read before approving
  outbox approve --outbox <file> --by <exec name> [--key <key>]...
                    Approve drafts as the named exec who read them; must be a club config approver
  outbox send --outbox <file> (--dry-run | --fake <mailbox file>)
                    Send approved messages once. No email provider is set up yet: --dry-run previews
                    what would go out and changes nothing; --fake delivers to a file and marks them sent

  Commands read club.config.json from the repo root when it exists, or the file given with --config.`;

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8")) as unknown;
const writeJson = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
const readOutbox = (path: string): OutboxMessage[] => (existsSync(path) ? z.array(OutboxMessageSchema).parse(readJson(path)) : []);

/** The club config at `path`, else club.config.json if present, else none. Throws listing every problem. */
function clubConfig(path?: string): ClubConfig | undefined {
  if (!path && !existsSync(clubConfigPath)) return undefined;
  const { config, problems } = loadClubConfig(path ?? clubConfigPath, loadModules().modules);
  if (!config || problems.length > 0) {
    throw new Error(`Club config has problems; fix them and re-run:\n${problems.map((p) => `  ${p.message}`).join("\n")}`);
  }
  return config;
}

export function config(argv: string[]): number {
  const [subcommand, ...rest] = argv;
  if (subcommand !== "check") {
    console.log(`Usage:\n${workflowUsage}`);
    return subcommand ? 1 : 0;
  }
  const { values } = parseArgs({ args: rest, options: { config: { type: "string" } } });
  const path = values.config ?? clubConfigPath;
  const { config, problems } = loadClubConfig(path, loadModules().modules);
  if (!config || problems.length > 0) {
    for (const p of problems) console.error(`✗ ${p.message}`);
    return 1;
  }
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  console.log(
    `✓ ${config.shortName ?? config.name} (${config.timezone}): ${count(config.approvers.length, "approver")}, ` +
      `${count(Object.keys(config.channels).length, "channel")}, ${count(Object.keys(config.templates).length, "template")}`,
  );
  return 0;
}

function required(values: Record<string, unknown>, ...names: string[]): void {
  const missing = names.filter((n) => typeof values[n] !== "string" || values[n] === "");
  if (missing.length > 0) throw new Error(`Missing ${missing.map((n) => `--${n}`).join(", ")}. Run pnpm clubkit for usage`);
}

export function closeRecruitment(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: { applications: { type: "string" }, templates: { type: "string" }, outbox: { type: "string" }, config: { type: "string" } },
  });
  required(values, "applications", "outbox");
  const applications = z.array(ApplicationSchema).parse(readJson(values.applications!));
  const templates = z.object({ accepted: EmailTemplateSchema, rejected: EmailTemplateSchema }).parse(decisionTemplates(values.templates, values.config));

  const result = draft(readOutbox(values.outbox!), decisionEmails(applications, templates));
  writeJson(values.outbox!, result.outbox);

  const statusOf = new Map(applications.map((a) => [`decision:${a.id}`, a.status]));
  const added = (status: string) => result.added.filter((m) => statusOf.get(m.key) === status).length;
  const summary = pipelineSummary(applications);
  const undecided = summary.submitted + summary.reviewing + summary.interview;

  console.log(`Drafted ${result.added.length} decision emails (${added("accepted")} accepted, ${added("rejected")} rejected).`);
  if (result.skipped.length > 0) console.log(`${result.skipped.length} applicants already had a decision email in the outbox; not drafted again.`);
  if (summary.withdrawn > 0) console.log(`No email for ${summary.withdrawn} withdrawn.`);
  if (undecided > 0) {
    console.log(
      `⚠ ${undecided} applicants have no decision yet (submitted ${summary.submitted}, reviewing ${summary.reviewing}, interview ${summary.interview}). They get no email until they're decided.`,
    );
  }
  console.log(`Nothing was sent. Next, an exec reads the drafts and approves them:
  pnpm clubkit outbox list --outbox ${values.outbox} --status draft
  pnpm clubkit outbox approve --outbox ${values.outbox} --by "<exec name>"`);
  return 0;
}

/** Decision templates from --templates, else the club config's decision-accepted and decision-rejected. */
function decisionTemplates(templatesPath?: string, configPath?: string): unknown {
  if (templatesPath) return readJson(templatesPath);
  const templates = clubConfig(configPath)?.templates;
  if (!templates?.["decision-accepted"] || !templates["decision-rejected"]) {
    throw new Error(
      "No decision templates. Pass --templates <file>, or add decision-accepted and decision-rejected under templates in club.config.json",
    );
  }
  return { accepted: templates["decision-accepted"], rejected: templates["decision-rejected"] };
}

export async function outbox(argv: string[]): Promise<number> {
  const [subcommand, ...rest] = argv;
  const { values } = parseArgs({
    args: rest,
    options: {
      outbox: { type: "string" },
      status: { type: "string" },
      by: { type: "string" },
      key: { type: "string", multiple: true },
      fake: { type: "string" },
      "dry-run": { type: "boolean" },
      config: { type: "string" },
    },
  });
  required(values, "outbox");
  const path = values.outbox!;
  const messages = readOutbox(path);

  switch (subcommand) {
    case "list": {
      for (const m of messages.filter((m) => !values.status || m.status === values.status)) {
        const approval = m.approvedBy ? ` (approved by ${m.approvedBy})` : "";
        console.log(`[${m.status}] ${m.key}${approval}\nTo: ${m.to}\nSubject: ${m.subject}\n\n${m.body}\n`);
      }
      const counts = outboxSummary(messages);
      console.log(`${counts.draft} draft, ${counts.approved} approved, ${counts.sent} sent`);
      return 0;
    }

    case "approve": {
      required(values, "by");
      const club = clubConfig(values.config);
      // With a club config, only a listed approver may approve, recorded under their configured name.
      let by = values.by!;
      if (club) {
        const approver = findApprover(club, by);
        if (!approver) throw new Error(`"${by}" is not an approver in the club config. Approvers: ${club.approvers.map((a) => a.name).join(", ")}`);
        by = approver.name;
      }
      const approved = approve(messages, by, { keys: values.key });
      writeJson(path, approved);
      console.log(`${by} approved ${outboxSummary(approved).approved - outboxSummary(messages).approved} messages. Send them with pnpm clubkit outbox send`);
      return 0;
    }

    case "send": {
      if (values["dry-run"]) {
        const preview = createRecorder<OutgoingEmail>("email", "dry-run");
        const result = await sendApproved(messages, preview);
        for (const m of result.previewed) console.log(`[would send] ${m.key} (approved by ${m.approvedBy})\nTo: ${m.to}\nSubject: ${m.subject}\n`);
        console.log(`Dry run: ${result.previewed.length} messages would be sent. Nothing was sent and the outbox is unchanged.`);
        return 0;
      }
      if (!values.fake) {
        throw new Error("No email provider is set up yet. Pass --dry-run to preview, or --fake <mailbox file> to deliver to a file instead");
      }
      const result = await sendApproved(messages, createFileRecorder<OutgoingEmail>("email", values.fake), { onSent: (o) => writeJson(path, o) });
      writeJson(path, result.outbox);
      console.log(`Sent ${result.sent.length} messages. ${outboxSummary(result.outbox).draft} drafts still need approval.`);
      if (result.error) {
        console.error(`Stopped at a failure: ${result.error.message}. Re-run to send the rest; nothing is sent twice.`);
        return 1;
      }
      return 0;
    }

    default:
      console.log(`Usage:\n${workflowUsage}`);
      return subcommand ? 1 : 0;
  }
}
