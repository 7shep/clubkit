import { createRecorder, type Recorder } from "@clubkit/integrations";
import {
  OutboxStatusSchema,
  type EmailAdapter,
  type EmailTemplate,
  type OutboxMessage,
  type OutboxStatus,
  type OutgoingEmail,
} from "@clubkit/schemas";

// The outbox is a list of messages, one per idempotency key, each moving
// draft -> approved -> sent. Functions return a new list; callers store it.

/**
 * Add emails to the outbox as drafts. An email whose key is already in the outbox is
 * skipped whatever its status, so re-running a workflow never drafts or sends twice.
 */
export function draft(
  outbox: OutboxMessage[],
  emails: OutgoingEmail[],
  now = new Date(),
): { outbox: OutboxMessage[]; added: OutboxMessage[]; skipped: string[] } {
  const keys = new Set(outbox.map((m) => m.key));
  const added: OutboxMessage[] = [];
  const skipped: string[] = [];
  for (const email of emails) {
    if (keys.has(email.key)) {
      skipped.push(email.key);
      continue;
    }
    keys.add(email.key);
    added.push({ ...email, status: "draft", createdAt: now.toISOString() });
  }
  return { outbox: [...outbox, ...added], added, skipped };
}

/**
 * Approve drafts on behalf of the exec who read them: every draft, or only `keys`.
 * Approval is a person's decision; an agent asked to "send" drafts and hands over instead.
 */
export function approve(
  outbox: OutboxMessage[],
  by: string,
  options: { keys?: string[]; now?: Date } = {},
): OutboxMessage[] {
  if (!by.trim()) throw new Error("approve needs the name of the exec who read the drafts, e.g. approve(outbox, \"Priya Shah\")");
  if (options.keys) {
    for (const key of options.keys) {
      const message = outbox.find((m) => m.key === key);
      if (!message) throw new Error(`No message with key "${key}" in the outbox`);
      if (message.status !== "draft") throw new Error(`Cannot approve "${key}": it is already ${message.status}. Only drafts can be approved`);
    }
  }
  const approvedAt = (options.now ?? new Date()).toISOString();
  const selected = (m: OutboxMessage) => m.status === "draft" && (!options.keys || options.keys.includes(m.key));
  return outbox.map((m) => (selected(m) ? { ...m, status: "approved", approvedBy: by.trim(), approvedAt } : m));
}

/**
 * Send every approved message once, in order. Drafts are never sent. Stops at the first
 * failure and returns what was sent so far, so the caller can save progress and re-run.
 * `onSent` runs after each send with the updated outbox; save it there to survive a crash.
 * Each email carries its key, which a real adapter passes to the provider as an idempotency key.
 * A dry-run adapter receives every approved message, and they come back in `previewed`, still approved.
 */
export async function sendApproved(
  outbox: OutboxMessage[],
  email: EmailAdapter,
  options: { now?: () => Date; onSent?: (outbox: OutboxMessage[]) => void | Promise<void> } = {},
): Promise<{ outbox: OutboxMessage[]; sent: OutboxMessage[]; previewed: OutboxMessage[]; error?: Error }> {
  const now = options.now ?? (() => new Date());
  let current = outbox;
  const sent: OutboxMessage[] = [];
  const previewed: OutboxMessage[] = [];
  for (const message of outbox) {
    if (message.status !== "approved") continue;
    try {
      const { id } = await email.send({ key: message.key, to: message.to, subject: message.subject, body: message.body });
      if (email.mode === "dry-run") {
        previewed.push(message);
        continue;
      }
      const done: OutboxMessage = { ...message, status: "sent", sentAt: now().toISOString(), providerId: id };
      current = current.map((m) => (m.key === message.key ? done : m));
      sent.push(done);
      await options.onSent?.(current);
    } catch (error) {
      return { outbox: current, sent, previewed, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
  return { outbox: current, sent, previewed };
}

/** Fill `{{field}}` placeholders. Throws on a placeholder with no value, naming the fields available. */
export function renderTemplate(template: EmailTemplate, fields: Record<string, string>): Pick<OutgoingEmail, "subject" | "body"> {
  const fill = (text: string) =>
    text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
      if (!(name in fields)) throw new Error(`Template uses {{${name}}}, which has no value. Available: ${Object.keys(fields).join(", ")}`);
      return fields[name];
    });
  return { subject: fill(template.subject), body: fill(template.body) };
}

/** Count messages per status. Every status appears, even at zero. */
export function outboxSummary(outbox: OutboxMessage[]): Record<OutboxStatus, number> {
  const summary = Object.fromEntries(OutboxStatusSchema.options.map((s) => [s, 0])) as Record<OutboxStatus, number>;
  for (const message of outbox) summary[message.status]++;
  return summary;
}

/** An email adapter that delivers to memory instead of sending. `failOn` makes chosen sends throw. */
export function createFakeEmail(options: { failOn?: (email: OutgoingEmail) => boolean } = {}): Recorder<OutgoingEmail> {
  return createRecorder<OutgoingEmail>("email", "fake", options);
}
