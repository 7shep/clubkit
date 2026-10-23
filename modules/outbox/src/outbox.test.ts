import { describe, expect, it } from "vitest";
import { OutboxMessageSchema, type OutboxMessage, type OutgoingEmail } from "@clubkit/schemas";
import { approve, createFakeEmail, draft, outboxSummary, renderTemplate, sendApproved } from "./index";

const email = (n: number): OutgoingEmail => ({
  key: `decision:${n}`,
  to: `person${n}@example.com`,
  subject: "Your application",
  body: `Hi person ${n}`,
});
const now = new Date("2026-11-20T15:00:00Z");

describe("outbox", () => {
  it("drafts valid messages and skips keys already in the outbox, whatever their status", () => {
    const first = draft([], [email(1), email(2)], now);
    expect(first.added).toHaveLength(2);
    for (const message of first.outbox) expect(OutboxMessageSchema.parse(message).status).toBe("draft");

    const sent: OutboxMessage[] = first.outbox.map((m) =>
      m.key === "decision:1" ? { ...m, status: "sent", approvedBy: "Priya", approvedAt: now.toISOString(), sentAt: now.toISOString() } : m,
    );
    const again = draft(sent, [email(1), email(2), email(3), email(3)], now);
    expect(again.added.map((m) => m.key)).toEqual(["decision:3"]);
    expect(again.skipped).toEqual(["decision:1", "decision:2", "decision:3"]);
    expect(again.outbox).toHaveLength(3);
  });

  it("approves drafts in the name of an exec, all or by key", () => {
    const { outbox } = draft([], [email(1), email(2)], now);
    const one = approve(outbox, "Priya Shah", { keys: ["decision:2"], now });
    expect(one.map((m) => m.status)).toEqual(["draft", "approved"]);
    expect(one[1]).toMatchObject({ approvedBy: "Priya Shah", approvedAt: now.toISOString() });
    expect(approve(one, "Priya Shah").every((m) => m.status === "approved")).toBe(true);
  });

  it("refuses an approval with no approver, or of a message that is not a draft", () => {
    const { outbox } = draft([], [email(1)], now);
    expect(() => approve(outbox, "  ")).toThrow(/name of the exec/);
    expect(() => approve(outbox, "Priya", { keys: ["decision:9"] })).toThrow(/No message/);
    expect(() => approve(approve(outbox, "Priya"), "Priya", { keys: ["decision:1"] })).toThrow(/already approved/);
  });

  it("sends approved messages once and never sends drafts", async () => {
    const { outbox } = draft([], [email(1), email(2)], now);
    const approved = approve(outbox, "Priya", { keys: ["decision:1"] });
    const fake = createFakeEmail();
    const first = await sendApproved(approved, fake, { now: () => now });
    expect(fake.delivered.map((e) => e.key)).toEqual(["decision:1"]);
    expect(first.outbox[0]).toMatchObject({ status: "sent", sentAt: now.toISOString(), providerId: "fake-1" });
    expect(first.outbox[1].status).toBe("draft");

    const second = await sendApproved(first.outbox, fake);
    expect(second.sent).toEqual([]);
    expect(fake.delivered).toHaveLength(1);
  });

  it("stops at a failure, keeps what was sent, and finishes on a re-run", async () => {
    const approved = approve(draft([], [email(1), email(2), email(3)], now).outbox, "Priya");
    const saved: OutboxMessage[][] = [];
    const flaky = createFakeEmail({ failOn: (e) => e.key === "decision:2" });
    const first = await sendApproved(approved, flaky, { onSent: (o) => void saved.push(o) });
    expect(first.error?.message).toMatch(/decision:2/);
    expect(first.sent.map((m) => m.key)).toEqual(["decision:1"]);
    expect(saved.at(-1)).toEqual(first.outbox);

    const fake = createFakeEmail();
    const second = await sendApproved(first.outbox, fake);
    expect(fake.delivered.map((e) => e.key)).toEqual(["decision:2", "decision:3"]);
    expect(outboxSummary(second.outbox)).toEqual({ draft: 0, approved: 0, sent: 3 });
  });

  it("fills templates and names the fields when a placeholder has no value", () => {
    const template = { subject: "Welcome, {{firstName}}", body: "You're our new {{ position }}." };
    expect(renderTemplate(template, { firstName: "Sam", position: "Developer" })).toEqual({
      subject: "Welcome, Sam",
      body: "You're our new Developer.",
    });
    expect(() => renderTemplate(template, { firstName: "Sam" })).toThrow(/\{\{position\}\}.*Available: firstName/);
  });
});
