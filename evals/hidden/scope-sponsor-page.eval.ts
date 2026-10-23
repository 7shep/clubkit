// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { describe } from "vitest";
import { checkScope } from "./support/scope";

describe("hidden: scope for the sponsors page", () => {
  checkScope({
    path: "scopes/sponsor-page.md",
    modules: ["sponsors"],
    commands: ["pnpm verify sponsors", "pnpm vitest run modules/sponsors", "pnpm check"],
    facts: [
      { label: "the ask: grouped by tier, gold first", pattern: /tier[\s\S]*gold|gold[\s\S]*tier/i },
      { label: "the ask: logos", pattern: /logo/i },
      {
        label: "the sponsors module is planned, not built, and must be made a working module",
        pattern: /planned|not (yet )?(built|implemented)|(isn't|is not|doesn't|does not)[^\n]{0,40}(built|exist|implemented)|docs only|no code|promot/i,
      },
      { label: "the Sponsor shape lives in packages/schemas", pattern: /packages\/schemas|SponsorSchema/ },
      { label: "the table is publicly readable but not writable", pattern: /public(ly)? read|\banon\b|\brls\b|row level/i },
      { label: "regenerate and validate the catalog", pattern: /pnpm (catalog|validate|check)/ },
    ],
  });
});
