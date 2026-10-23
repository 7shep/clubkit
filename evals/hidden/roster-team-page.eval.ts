// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { teamPage } from "../modules/roster/src/index";

const member = (fullName: string, role: string, extra: Record<string, string> = {}) => ({
  id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  fullName,
  email: `${fullName.split(" ")[0].toLowerCase()}@example.com`,
  role,
  ...extra,
});

const execs = [
  member("Zoe Park", "VP Events", { team: "Events", pronouns: "she/her" }),
  member("Ana Lopez", "President", { linkedinUrl: "https://www.linkedin.com/in/ana" }),
  member("Bo Chen", "Developer", { team: "Tech" }),
];

describe("hidden: team page", () => {
  it("lists everyone sorted by name with their role and team", () => {
    const page = teamPage(execs) as Record<string, unknown>[];
    expect(JSON.stringify(page)).toMatch(/Ana Lopez[\s\S]*Bo Chen[\s\S]*Zoe Park/);
    const text = JSON.stringify(page);
    for (const value of ["President", "VP Events", "Developer", "Events", "Tech"]) expect(text).toContain(value);
  });

  it("puts no emails on a public page", () => {
    // Members' emails are personal data; a public team page must not carry them.
    expect(JSON.stringify(teamPage(execs))).not.toMatch(/@example\.com/);
  });

  it("makes roster a working module", () => {
    const manifest = JSON.parse(readFileSync("modules/roster/module.json", "utf8"));
    expect(manifest.status).not.toBe("planned");
    expect(manifest.verify).toBeTruthy();
    expect(manifest.provides.exports).toContain("teamPage");
  });
});
