import { describe, expect, it } from "vitest";
import type { Application } from "@clubkit/schemas";
import { allowedTransitions, decisionEmails, parseApplication, pipelineSummary, transition } from "./index";

const base: Application = {
  id: "0b6f2b5e-3a3c-4d8e-9f0a-1c2d3e4f5a6b",
  submittedAt: "2026-10-01T12:00:00Z",
  fullName: "Sam Rivera",
  email: "sam@example.com",
  graduationYear: 2028,
  program: "Computing",
  position: "Developer",
  answers: { why: "I like building things." },
  consent: true,
  status: "submitted",
};

describe("applications", () => {
  it("accepts a valid new submission before the deadline", () => {
    expect(parseApplication(base, { deadline: "2026-11-15T23:59:00-05:00", now: new Date("2026-11-01") }).fullName).toBe(
      "Sam Rivera",
    );
  });

  it("refuses late, unconsented, or pre-decided submissions", () => {
    expect(() => parseApplication(base, { deadline: "2026-09-30T00:00:00Z", now: new Date("2026-10-01") })).toThrow(/closed/);
    expect(() => parseApplication({ ...base, consent: false })).toThrow();
    expect(() => parseApplication({ ...base, status: "accepted" })).toThrow(/submitted/);
  });

  it("enforces the review pipeline", () => {
    const interviewing = transition(transition(base, "reviewing"), "interview");
    expect(interviewing.status).toBe("interview");
    expect(base.status).toBe("submitted");
    expect(() => transition(base, "interview")).toThrow(/Allowed: reviewing, rejected, withdrawn/);
    expect(() => transition({ ...base, status: "accepted" }, "rejected")).toThrow(/final/);
    expect(allowedTransitions("rejected")).toEqual([]);
  });

  it("summarizes the pipeline per position", () => {
    const apps: Application[] = [
      base,
      { ...base, status: "reviewing" },
      { ...base, status: "accepted", position: "Designer" },
    ];
    expect(pipelineSummary(apps)).toMatchObject({ submitted: 1, reviewing: 1, accepted: 1, rejected: 0 });
    expect(pipelineSummary(apps, "Developer")).toMatchObject({ submitted: 1, reviewing: 1, accepted: 0 });
  });
});

describe("decision emails", () => {
  const templates = {
    accepted: { subject: "Welcome to the club", body: "Hi {{firstName}}, you're our new {{position}}." },
    rejected: { subject: "Your application", body: "Hi {{firstName}}, thank you for applying." },
  };
  const applicant = (n: number, status: Application["status"]): Application => ({
    ...base,
    id: `0b6f2b5e-3a3c-4d8e-9f0a-1c2d3e4f5a${String(n).padStart(2, "0")}`,
    fullName: `Person${n} Example`,
    email: `person${n}@example.com`,
    status,
  });

  it("drafts one email per final decision and none for withdrawn or undecided applicants", () => {
    const statuses = ["accepted", "rejected", "withdrawn", "submitted", "reviewing", "interview"] as const;
    const emails = decisionEmails(statuses.map((s, i) => applicant(i, s)), templates);
    expect(emails).toEqual([
      { key: `decision:${applicant(0, "accepted").id}`, to: "person0@example.com", subject: "Welcome to the club", body: "Hi Person0, you're our new Developer." },
      { key: `decision:${applicant(1, "rejected").id}`, to: "person1@example.com", subject: "Your application", body: "Hi Person1, thank you for applying." },
    ]);
  });
});
