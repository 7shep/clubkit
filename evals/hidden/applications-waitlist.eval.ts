// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ApplicationStatusSchema } from "../packages/schemas/src/index";
import { allowedTransitions, pipelineSummary, transition } from "../modules/applications/src/index";

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

describe("hidden: waitlisted status", () => {
  it("is a valid status", () => {
    expect(ApplicationStatusSchema.safeParse("waitlisted").success).toBe(true);
  });

  it("is reachable only from interview and leads to a final decision or withdrawal", () => {
    expect(transition({ ...app, status: "interview" }, "waitlisted" as never).status).toBe("waitlisted");
    expect(() => transition({ ...app, status: "submitted" }, "waitlisted" as never)).toThrow();
    expect(() => transition({ ...app, status: "reviewing" }, "waitlisted" as never)).toThrow();
    expect([...allowedTransitions("waitlisted" as never)].sort()).toEqual(["accepted", "rejected", "withdrawn"]);
  });

  it("appears in pipeline summaries", () => {
    expect(pipelineSummary([{ ...app, status: "waitlisted" as never }])).toMatchObject({ waitlisted: 1 });
  });

  it("is allowed by the database", () => {
    const dir = "modules/applications/migrations";
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(`${dir}/${f}`, "utf8"))
      .join("\n");
    expect(sql).toMatch(/'waitlisted'/);
  });
});
