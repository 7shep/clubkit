// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { describe } from "vitest";
import { checkScope } from "./support/scope";

describe("hidden: scope for RSVP reminder emails", () => {
  checkScope({
    path: "scopes/rsvp-reminders.md",
    modules: ["events"],
    commands: ["pnpm verify events"],
    facts: [
      { label: "the ask: a reminder the day before", pattern: /day before|24 hours|evening before|night before/i },
      { label: "the ask: only people who RSVP'd", pattern: /rsvp/i },
      {
        label: "RSVPs are not stored yet, so that comes first",
        pattern: /(no|not|n't|missing|yet|first|before|prerequisite|depend|block)[^\n]{0,120}rsvp[^\n]{0,60}(stor|table|persist|saved|record)|rsvp[^\n]{0,60}(stor|table|persist|saved|record)[^\n]{0,120}(no|not|n't|missing|yet|first|before|prerequisite|depend|block)/i,
      },
      { label: "event times are in the club's timezone", pattern: /time ?zone/i },
      { label: "RSVPs hold emails, which must stay private", pattern: /personal|private|privacy|service role|\brls\b|row level/i },
    ],
  });
});
