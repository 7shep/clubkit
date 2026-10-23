// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { describe } from "vitest";
import { checkScope } from "./support/scope";

describe("hidden: scope for application decision emails", () => {
  checkScope({
    path: "scopes/decision-emails.md",
    modules: ["applications"],
    commands: ["pnpm verify applications"],
    facts: [
      { label: "the ask: accepted applicants get an email", pattern: /accepted/i },
      { label: "the ask: rejected applicants get an email", pattern: /rejected/i },
      { label: "the ask: nobody gets the same email twice", pattern: /twice|only once|exactly once|more than once|duplicate|idempot|already (been )?sent/i },
      { label: "what happens to withdrawn applicants", pattern: /withdrawn/i },
      { label: "decisions are final and change only through transition()", pattern: /transition|final/i },
      { label: "applicant data is private (service role only)", pattern: /personal|private|privacy|service role|\brls\b|row level/i },
    ],
  });
});
