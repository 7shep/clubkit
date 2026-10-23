// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as schemas from "../packages/schemas/src/index";
import { addRsvp } from "../modules/events/src/index";

const eventId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const otherEventId = "9b2f8d1e-1c4a-4f6e-8a3b-2d5c7e9f1a0b";
const event = { id: eventId, name: "Resume Workshop", description: "", date: "2026-11-20", rsvpCap: 2 };
const rsvp = (email: string, id = eventId) => ({ eventId: id, name: email.split("@")[0], email });

describe("hidden: RSVP storage", () => {
  it("adds an Rsvp shared schema", () => {
    const shared = schemas.sharedSchemas as Record<string, { safeParse: (v: unknown) => { success: boolean } }>;
    expect(shared.Rsvp).toBeDefined();
    expect(shared.Rsvp.safeParse(rsvp("ana@example.com")).success).toBe(true);
    expect(shared.Rsvp.safeParse({ ...rsvp("ana@example.com"), email: "not-an-email" }).success).toBe(false);
  });

  it("accepts sign-ups until the cap, then refuses", () => {
    const one = addRsvp(event, [], rsvp("ana@example.com"));
    const two = addRsvp(event, one, rsvp("bo@example.com"));
    expect(two).toHaveLength(2);
    expect(() => addRsvp(event, two, rsvp("cy@example.com"))).toThrow();
  });

  it("does not mutate the existing list", () => {
    const existing = [rsvp("ana@example.com")];
    addRsvp(event, existing, rsvp("bo@example.com"));
    expect(existing).toHaveLength(1);
  });

  it("counts only this event's RSVPs toward the cap", () => {
    const others = [rsvp("x@example.com", otherEventId), rsvp("y@example.com", otherEventId)];
    expect(addRsvp(event, others, rsvp("ana@example.com"))).toHaveLength(3);
  });

  it("refuses the same email twice, ignoring case", () => {
    const one = addRsvp({ ...event, rsvpCap: 10 }, [], rsvp("ana@example.com"));
    expect(() => addRsvp({ ...event, rsvpCap: 10 }, one, rsvp("ANA@Example.com"))).toThrow();
  });

  it("never caps an uncapped event", () => {
    const uncapped = { ...event, rsvpCap: undefined };
    let list: ReturnType<typeof addRsvp> = [];
    for (let i = 0; i < 50; i++) list = addRsvp(uncapped, list, rsvp(`p${i}@example.com`));
    expect(list).toHaveLength(50);
  });

  it("stores RSVPs in a private table linked to events", () => {
    const manifest = JSON.parse(readFileSync("modules/events/module.json", "utf8"));
    expect(manifest.provides.exports).toContain("addRsvp");
    const dir = "modules/events/migrations";
    const added = readdirSync(dir).filter((f) => f.endsWith(".sql") && f !== "0001_events.sql");
    expect(added.length).toBeGreaterThan(0);
    for (const file of added) expect(manifest.provides.migrations).toContain(`migrations/${file}`);

    const sql = added
      .map((f) => readFileSync(`${dir}/${f}`, "utf8"))
      .join("\n")
      .toLowerCase()
      .replace(/--[^\n]*/g, "");
    expect(sql).toMatch(/references\s+(public\.)?events/);
    expect(sql).toContain("email");
    expect(sql).toContain("enable row level security");
    // RSVPs hold emails, so nothing may be readable with the anon key. A policy with no `to` applies to every role.
    const statements = sql.split(";");
    const openPolicies = statements.filter(
      (s) => /create policy/.test(s) && (/\bto\s[^;]*\b(anon|public)\b/.test(s) || !/\bto\s/.test(s.replace(/\busing[\s\S]*/, ""))),
    );
    expect(openPolicies).toEqual([]);
    expect(statements.filter((s) => /\bgrant\s[^;]*\bto\s[^;]*\b(anon|public)\b/.test(s))).toEqual([]);
  });
});
