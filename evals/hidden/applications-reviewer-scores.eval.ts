// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as schemas from "../packages/schemas/src/index";
import { averageScores } from "../modules/applications/src/index";

const sam = "0b6f2b5e-3a3c-4d8e-9f0a-1c2d3e4f5a6b";
const ana = "5d1c9a7e-2b4f-4c6a-8e0d-3f5b7a9c1e2d";
const score = (applicationId: string, reviewer: string, value: number) => ({ applicationId, reviewer, score: value });

describe("hidden: reviewer scores", () => {
  it("adds a ReviewScore shared schema that only allows whole scores from 1 to 5", () => {
    const shared = schemas.sharedSchemas as Record<string, { safeParse: (v: unknown) => { success: boolean } }>;
    expect(shared.ReviewScore).toBeDefined();
    expect(shared.ReviewScore.safeParse(score(sam, "pres@club.ca", 4)).success).toBe(true);
    expect(shared.ReviewScore.safeParse({ ...score(sam, "pres@club.ca", 4), comment: "Strong portfolio" }).success).toBe(true);
    for (const bad of [0, 6, 3.5]) expect(shared.ReviewScore.safeParse(score(sam, "pres@club.ca", bad)).success).toBe(false);
  });

  it("averages per applicant and counts reviewers", () => {
    const result = averageScores([score(sam, "a", 4), score(sam, "b", 5), score(ana, "a", 2)]);
    expect(result[sam]).toEqual({ average: 4.5, count: 2 });
    expect(result[ana]).toEqual({ average: 2, count: 1 });
  });

  it("counts only a reviewer's last score for the same applicant", () => {
    expect(averageScores([score(sam, "a", 1), score(sam, "b", 3), score(sam, "a", 5)])[sam]).toEqual({ average: 4, count: 2 });
  });

  it("leaves out applicants nobody has scored", () => {
    expect(averageScores([])).toEqual({});
  });

  it("stores scores privately, linked to applications", () => {
    const manifest = JSON.parse(readFileSync("modules/applications/module.json", "utf8"));
    expect(manifest.provides.exports).toContain("averageScores");
    const dir = "modules/applications/migrations";
    const added = readdirSync(dir).filter((f) => f.endsWith(".sql") && f !== "0001_applications.sql");
    expect(added.length).toBeGreaterThan(0);
    for (const file of added) expect(manifest.provides.migrations).toContain(`migrations/${file}`);

    const sql = added.map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("\n").toLowerCase();
    expect(sql).toMatch(/references\s+(public\.)?applications/);
    expect(sql).toContain("enable row level security");
    expect(sql).not.toContain("create policy");
    expect(sql).not.toMatch(/grant\s+[^;]*\bto\s+[^;]*(anon|authenticated|public)\b/);
  });
});
