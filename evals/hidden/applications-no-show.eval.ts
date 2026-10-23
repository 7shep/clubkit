// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ApplicationStatusSchema } from "../packages/schemas/src/index";
import { pipelineSummary, transition } from "../modules/applications/src/index";

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
};

// Any reasonable spelling: no_show, no-show, noshow, "no show".
const noShow = ApplicationStatusSchema.options.find((s: string) => /^no[-_ ]?show$/i.test(s)) as never;
const dir = "modules/applications/migrations";

describe("hidden: interview no-shows", () => {
  it("is a status of its own", () => {
    expect(noShow, `statuses: ${ApplicationStatusSchema.options.join(", ")}`).toBeDefined();
  });

  it("is reached from interview, not before it", () => {
    expect(transition({ ...app, status: "interview" }, noShow).status).toBe(noShow);
    expect(() => transition({ ...app, status: "submitted" }, noShow)).toThrow();
    expect(() => transition({ ...app, status: "reviewing" }, noShow)).toThrow();
  });

  it("is counted separately from rejections", () => {
    const summary = pipelineSummary([{ ...app, status: noShow }, { ...app, status: "rejected" }]) as Record<string, number>;
    expect(summary[noShow]).toBe(1);
    expect(summary.rejected).toBe(1);
  });

  it("is allowed by the database through a new migration, leaving the applied one untouched", () => {
    // Clubs may already have applied 0001; editing it would never reach their database.
    expect(execFileSync("git", ["diff", "--name-only", "HEAD", "--", `${dir}/0001_applications.sql`], { encoding: "utf8" }).trim()).toBe("");
    const added = readdirSync(dir).filter((f) => f.endsWith(".sql") && f !== "0001_applications.sql");
    expect(added.length).toBeGreaterThan(0);
    const manifest = JSON.parse(readFileSync("modules/applications/module.json", "utf8"));
    for (const file of added) expect(manifest.provides.migrations).toContain(`migrations/${file}`);
    const sql = added.map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("\n");
    expect(sql).toContain(`'${noShow}'`);
  });
});
