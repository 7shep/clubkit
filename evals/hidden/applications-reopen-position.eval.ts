// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ApplicationSchema } from "../packages/schemas/src/index";
import { nextRound, pipelineSummary, transition } from "../modules/applications/src/index";

const app = {
  id: "0b6f2b5e-3a3c-4d8e-9f0a-1c2d3e4f5a6b",
  submittedAt: "2026-10-01T12:00:00Z",
  fullName: "Sam Rivera",
  email: "sam@example.com",
  graduationYear: 2028,
  program: "Computing",
  position: "Developer",
  answers: {},
  consent: true as const,
  status: "submitted" as const,
};

describe("hidden: reopening a position", () => {
  it("adds an optional positive whole-number round to applications", () => {
    expect(ApplicationSchema.safeParse(app).success).toBe(true);
    expect(ApplicationSchema.safeParse({ ...app, round: 2 }).success).toBe(true);
    for (const bad of [0, -1, 1.5]) expect(ApplicationSchema.safeParse({ ...app, round: bad }).success).toBe(false);
  });

  it("picks the next round per position, treating a missing round as round 1", () => {
    expect(nextRound([], "Developer")).toBe(1);
    expect(nextRound([{ ...app, status: "rejected" }], "Developer")).toBe(2);
    expect(nextRound([{ ...app, status: "accepted" }, { ...app, round: 2 }], "Developer")).toBe(3);
    expect(nextRound([{ ...app, round: 4 }], "Designer")).toBe(1);
  });

  it("keeps past decisions and reports each round separately", () => {
    const apps = [
      { ...app, status: "accepted" as const },
      { ...app, status: "rejected" as const, round: 1 },
      { ...app, status: "submitted" as const, round: 2 },
      { ...app, status: "submitted" as const, round: 2, position: "Designer" },
    ];
    expect(pipelineSummary(apps, "Developer", 1)).toMatchObject({ accepted: 1, rejected: 1, submitted: 0 });
    expect(pipelineSummary(apps, "Developer", 2)).toMatchObject({ accepted: 0, rejected: 0, submitted: 1 });
    expect(pipelineSummary(apps, "Developer")).toMatchObject({ accepted: 1, rejected: 1, submitted: 1 });
    expect(() => transition(apps[1], "reviewing")).toThrow();
  });

  it("lets the same email apply once per position per round in the database", () => {
    const dir = "modules/applications/migrations";
    const added = readdirSync(dir).filter((f) => f.endsWith(".sql") && f !== "0001_applications.sql");
    expect(added.length).toBeGreaterThan(0);
    const manifest = JSON.parse(readFileSync("modules/applications/module.json", "utf8"));
    for (const file of added) expect(manifest.provides.migrations).toContain(`migrations/${file}`);

    const sql = added.map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("\n").toLowerCase();
    expect(sql).toMatch(/add column[^;]*\bround\b/);
    expect(sql).toMatch(/drop (constraint|index)/);
    const uniques = [...sql.matchAll(/unique[^;(]*\(([^)]*)\)/g)].map((m) => m[1].split(",").map((c) => c.trim()).sort().join(","));
    expect(uniques).toContain("email,position,round");
  });
});
