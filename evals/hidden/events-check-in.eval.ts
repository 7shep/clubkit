// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as schemas from "../packages/schemas/src/index";
import { checkIn } from "../modules/events/src/index";

const event = { id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", name: "Hack Night", description: "", date: "2026-11-05" };
const other = { ...event, id: "9b2f8d1e-1c4a-4f6e-8a3b-2d5c7e9f1a0b" };
const dir = "modules/events/migrations";
const read = (path: string) => readFileSync(path, "utf8");

describe("hidden: event check-ins", () => {
  it("records arrivals and counts a repeat check-in once", () => {
    const one = checkIn(event, [], { name: "Ana", email: "ana@example.com" });
    const two = checkIn(event, one, { name: "Bo", email: "bo@example.com" });
    expect(two).toHaveLength(2);
    expect(checkIn(event, two, { name: "Ana", email: "ANA@example.com" })).toHaveLength(2);
    expect(one).toHaveLength(1);
  });

  it("keeps each event's check-ins separate", () => {
    const atOther = checkIn(other, [], { name: "Ana", email: "ana@example.com" });
    expect(checkIn(event, atOther, { name: "Ana", email: "ana@example.com" })).toHaveLength(2);
  });

  it("refuses a check-in without a valid email", () => {
    expect(() => checkIn(event, [], { name: "Ana", email: "nope" })).toThrow();
  });

  it("defines the check-in shape in packages/schemas, not in the module", () => {
    const known = ["Member", "Event", "Application", "Sponsor"];
    const added = Object.keys(schemas.sharedSchemas).filter((k) => !known.includes(k));
    expect(added.length, "a new shared schema registered in sharedSchemas").toBeGreaterThan(0);
    const manifest = JSON.parse(read("modules/events/module.json"));
    expect(added.some((k) => manifest.provides.schemas.includes(k)), "events provides the shared schema").toBe(true);
    expect(manifest.provides.exports).toContain("checkIn");
    const src = readdirSync("modules/events/src")
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .map((f) => read(`modules/events/src/${f}`))
      .join("\n");
    expect(src).not.toMatch(/z\.object\(\{[^}]*\bemail\b/s);
  });

  it("stores check-ins privately in a new migration, leaving the applied one untouched", () => {
    expect(execFileSync("git", ["diff", "--name-only", "HEAD", "--", `${dir}/0001_events.sql`], { encoding: "utf8" }).trim()).toBe("");
    const added = readdirSync(dir).filter((f) => f.endsWith(".sql") && f !== "0001_events.sql");
    expect(added.length).toBeGreaterThan(0);
    const manifest = JSON.parse(read("modules/events/module.json"));
    for (const file of added) expect(manifest.provides.migrations).toContain(`migrations/${file}`);

    const sql = added
      .map((f) => read(`${dir}/${f}`))
      .join("\n")
      .toLowerCase()
      .replace(/--[^\n]*/g, "");
    expect(sql).toMatch(/references\s+(public\.)?events/);
    expect(sql).toContain("enable row level security");
    // Check-ins say who was where: nothing may be readable with the anon key.
    const statements = sql.split(";");
    const open = statements.filter(
      (s) => /create policy/.test(s) && (/\bto\s[^;]*\b(anon|public)\b/.test(s) || !/\bto\s/.test(s.replace(/\b(using|with check)[\s\S]*/, ""))),
    );
    expect(open).toEqual([]);
    expect(statements.filter((s) => /\bgrant\s[^;]*\bto\s[^;]*\b(anon|public)\b/.test(s))).toEqual([]);
  });
});
