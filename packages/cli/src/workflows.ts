import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { decisionEmails, pipelineSummary } from "@clubkit/applications";
import { approve, draft, outboxSummary, sendApproved } from "@clubkit/outbox";
import {
  ApplicationSchema,
  EmailTemplateSchema,
  OutboxMessageSchema,
  type EmailAdapter,
  type OutboxMessage,
  type OutgoingEmail,
} from "@clubkit/schemas";
import { z } from "zod";

// Workflow commands. Each follows the same shape: work out what's needed, draft,
// an exec approves, send, report counts. Output names no applicants, so it can be pasted anywhere.

export const workflowUsage = `  close-recruitment --applications <file> --templates <file> --outbox <file>
                    Draft one decision email per accepted or rejected applicant. Sends nothing
  outbox list --outbox <file> [--status draft|approved|sent]
                    Show messages in full, for an exec to read before approving
  outbox approve --outbox <file> --by <exec name> [--key <key>]...
                    Approve drafts as the named exec who read them
  outbox send --outbox <file> --fake <mailbox file>
                    Send approved messages once. No email provider is set up yet: --fake delivers to a file`;

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8")) as unknown;
const writeJson = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
const readOutbox = (path: string): OutboxMessage[] => (existsSync(path) ? z.array(OutboxMessageSchema).parse(readJson(path)) : []);

function required(values: Record<string, unknown>, ...names: string[]): void {
  const missing = names.filter((n) => typeof values[n] !== "string" || values[n] === "");
  if (missing.length > 0) throw new Error(`Missing ${missing.map((n) => `--${n}`).join(", ")}. Run pnpm clubkit for usage`);
}

export function closeRecruitment(argv: string[]): number {
  const { values } = parseArgs({ args: argv, options: { applications: { type: "string" }, templates: { type: "string" }, outbox: { type: "string" } } });
  required(values, "applications", "templates", "outbox");
  const applications = z.array(ApplicationSchema).parse(readJson(values.applications!));
  const templates = z.object({ accepted: EmailTemplateSchema, rejected: EmailTemplateSchema }).parse(readJson(values.templates!));

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

/** Delivers to a JSON file instead of sending, until the club picks an email provider. */
function fileMailbox(path: string): EmailAdapter {
  return {
    async send(email) {
      const delivered = existsSync(path) ? (readJson(path) as OutgoingEmail[]) : [];
      delivered.push(email);
      writeJson(path, delivered);
      return { id: `fake-${delivered.length}` };
    },
  };
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
      const approved = approve(messages, values.by!, { keys: values.key });
      writeJson(path, approved);
      console.log(`${values.by} approved ${outboxSummary(approved).approved - outboxSummary(messages).approved} messages. Send them with pnpm clubkit outbox send`);
      return 0;
    }

    case "send": {
      if (!values.fake) throw new Error("No email provider is set up yet. Pass --fake <mailbox file> to deliver to a file instead");
      const result = await sendApproved(messages, fileMailbox(values.fake), { onSent: (o) => writeJson(path, o) });
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
