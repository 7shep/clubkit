// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { handOffRole } from "../modules/roster/src/index";

const ana = { id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301", fullName: "Ana Lopez", email: "ana@example.com", role: "VP Events" };
const bo = { id: "5d1c9a7e-2b4f-4c6a-8e0d-3f5b7a9c1e2d", fullName: "Bo Chen", email: "bo@example.com", role: "Member" };
const cy = { id: "9b2f8d1e-1c4a-4f6e-8a3b-2d5c7e9f1a0b", fullName: "Cy Diaz", email: "cy@example.com", role: "President" };
const request = { role: "VP Events", fromMemberId: ana.id, toMemberId: bo.id, on: "2027-05-01" };

describe("hidden: exec handoff", () => {
  it("moves the role, makes the outgoing member Alumni, and leaves everyone else alone", () => {
    const { members } = handOffRole([ana, bo, cy], request);
    const byId = Object.fromEntries(members.map((m: { id: string; role: string }) => [m.id, m.role]));
    expect(byId).toEqual({ [ana.id]: "Alumni", [bo.id]: "VP Events", [cy.id]: "President" });
    expect(ana.role).toBe("VP Events");
    expect(bo.role).toBe("Member");
  });

  it("returns a record of the handoff with its date", () => {
    expect(handOffRole([ana, bo, cy], request).handoff).toMatchObject(request);
  });

  it("refuses handoffs that don't make sense", () => {
    expect(() => handOffRole([ana, bo], { ...request, role: "President" })).toThrow();
    expect(() => handOffRole([ana, bo], { ...request, toMemberId: cy.id })).toThrow();
    expect(() => handOffRole([bo, cy], request)).toThrow();
    expect(() => handOffRole([ana, bo], { ...request, toMemberId: ana.id })).toThrow();
    expect(() => handOffRole([ana, bo], { ...request, on: "May 1" })).toThrow();
  });

  it("is a working module that stores handoffs with their date", () => {
    const manifest = JSON.parse(readFileSync("modules/roster/module.json", "utf8"));
    expect(manifest.status).not.toBe("planned");
    expect(manifest.verify).toBeTruthy();
    expect(manifest.provides.exports).toContain("handOffRole");

    const dir = "modules/roster/migrations";
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));
    for (const file of files) expect(manifest.provides.migrations).toContain(`migrations/${file}`);
    const sql = files.map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("\n").toLowerCase();
    expect(sql).toMatch(/create table[^;(]*(handoff|handover)/);
    expect(sql).toMatch(/\bdate\b[^,;]*not null|not null[^,;]*\bdate\b|\s(date|timestamptz)\s+not null/);
    expect(sql).toContain("enable row level security");
  });
});
