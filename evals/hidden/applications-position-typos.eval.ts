// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { describe, expect, it } from "vitest";
import { pipelineSummary } from "../modules/applications/src/index";

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

// Stored applications as the form saved them: the fix has to work on existing data.
const stored = [
  app,
  { ...app, position: "developer" },
  { ...app, position: "Developer " },
  { ...app, position: "  DEVELOPER" },
  { ...app, position: "developer", status: "interview" as const },
  { ...app, position: "Developer Lead" },
  { ...app, position: "Designer" },
];

describe("hidden: position typos in the pipeline count", () => {
  it("counts a position however applicants typed it", () => {
    expect(pipelineSummary(stored, "Developer")).toMatchObject({ submitted: 4, interview: 1 });
    expect(pipelineSummary(stored, "developer ")).toMatchObject({ submitted: 4, interview: 1 });
  });

  it("does not merge different positions", () => {
    expect(pipelineSummary(stored, "Developer Lead")).toMatchObject({ submitted: 1, interview: 0 });
    expect(pipelineSummary(stored, "Designer")).toMatchObject({ submitted: 1, interview: 0 });
  });

  it("leaves the all-positions summary unchanged", () => {
    expect(pipelineSummary(stored)).toMatchObject({ submitted: 6, interview: 1 });
  });
});
