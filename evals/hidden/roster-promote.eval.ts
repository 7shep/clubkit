// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { publicProfiles } from "../modules/roster/src/index";

const member = (fullName: string, extra: Record<string, string> = {}) => ({
  id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  fullName,
  email: `${fullName.split(" ")[0].toLowerCase()}@example.com`,
  role: "Developer",
  ...extra,
});

function migrationsSql(): string {
  const dir = "modules/roster/migrations";
  if (!existsSync(dir)) return "";
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(`${dir}/${f}`, "utf8"))
    .join("\n")
    .toLowerCase()
    .replace(/--[^\n]*/g, "");
}

const name = (raw: string) => raw.replace(/^public\./, "").replace(/"/g, "");

describe("hidden: roster module", () => {
  it("lists the team page sorted by name without emails", () => {
    const profiles = publicProfiles([
      member("Zoe Park", { team: "Events", pronouns: "she/her" }),
      member("Ana Lopez", { role: "President" }),
    ]) as Record<string, unknown>[];
    expect(profiles.map((p) => p.fullName)).toEqual(["Ana Lopez", "Zoe Park"]);
    expect(profiles[0]).toMatchObject({ role: "President" });
    expect(profiles[1]).toMatchObject({ team: "Events", pronouns: "she/her" });
    for (const profile of profiles) expect(profile).not.toHaveProperty("email");
    expect(JSON.stringify(profiles)).not.toContain("@example.com");
  });

  it("is a working module", () => {
    const manifest = JSON.parse(readFileSync("modules/roster/module.json", "utf8"));
    expect(manifest.status).not.toBe("planned");
    expect(manifest.verify).toBeTruthy();
    expect(manifest.provides.exports).toContain("publicProfiles");
    expect(manifest.provides.schemas).toContain("Member");
    expect(manifest.provides.migrations.length).toBeGreaterThan(0);
  });

  it("stores members with RLS, a publicly readable team page, and private emails", () => {
    const sql = migrationsSql();
    expect(sql).toContain("enable row level security");

    const statements = sql.split(";").map((s) => s.trim());
    const withEmail = statements
      .map((s) => s.match(/^create table(?: if not exists)?\s+([\w."]+)\s*\(([\s\S]*)\)$/))
      .filter((m): m is RegExpMatchArray => m !== null && /\bemail\b/.test(m[2]))
      .map((m) => name(m[1]));
    expect(withEmail.length).toBeGreaterThan(0);

    // Something must be readable with the anon key, or there is no public team page.
    // A policy with no `to` clause applies to every role, anon included.
    const anonPolicies = statements
      .map((s) => s.match(/^create policy[\s\S]*?\bon\s+([\w."]+)([\s\S]*)$/))
      .filter((m): m is RegExpMatchArray => m !== null && !/\bfor\s+(insert|update|delete)\b/.test(m[2]))
      .filter((m) => !/\bto\b/.test(m[2].replace(/\busing[\s\S]*/, "")) || /\bto\s+[^;]*\b(anon|public)\b/.test(m[2]))
      .map((m) => name(m[1]));
    const anonGrants = statements
      .map((s) => s.match(/^grant\s+(?:select|all(?: privileges)?)\s*(\(([^)]*)\))?\s*on\s+(?:table\s+)?([\w."]+)\s+to\s+([\s\S]*)$/))
      .filter((m): m is RegExpMatchArray => m !== null && /\b(anon|public)\b/.test(m[4]))
      .map((m) => ({ columns: m[2]?.split(",").map((c) => c.trim()), target: name(m[3]) }));
    expect(anonPolicies.length + anonGrants.length).toBeGreaterThan(0);

    for (const table of withEmail) {
      // A whole-table grant to anon exposes email.
      expect(anonGrants.filter((g) => g.target === table && !g.columns)).toEqual([]);
      // A column grant to anon must not include email.
      for (const grant of anonGrants.filter((g) => g.target === table && g.columns)) expect(grant.columns).not.toContain("email");
      // An anon read policy on the table itself is only safe with column privileges that withhold email.
      if (anonPolicies.includes(table)) {
        expect(sql).toMatch(new RegExp(`revoke\\s+(select|all)[^;]*on\\s+(table\\s+)?(public\\.)?"?${table}"?\\s+from\\s+[^;]*\\banon\\b`));
        expect(anonGrants.some((g) => g.target === table && g.columns)).toBe(true);
      }
    }

    // A public view must not select email or select everything from a table that has it.
    for (const view of sql.matchAll(/create(?: or replace)? view\s+([\w."]+)[\s\S]*?\bas\s+select([\s\S]*?);/g)) {
      expect(view[2]).not.toMatch(/\bemail\b/);
      expect(view[2]).not.toMatch(/(^|\s|,)\*|\.\*/);
    }
  });
});
