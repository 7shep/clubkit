// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as schemas from "../packages/schemas/src/index";
import { subscribe } from "../modules/newsletter/src/index";

const dir = "modules/newsletter";
const read = (path: string) => readFileSync(path, "utf8");
const sources = () =>
  readdirSync(`${dir}/src`)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => read(`${dir}/src/${f}`))
    .join("\n");

describe("hidden: newsletter signup", () => {
  it("adds valid signups and ignores repeats, whatever the case", () => {
    const one = subscribe({ name: "Ana Lopez", email: "ana@example.com" }, []);
    expect(one).toHaveLength(1);
    const two = subscribe({ name: "Bo Chen", email: "bo@example.com" }, one);
    expect(two).toHaveLength(2);
    expect(subscribe({ name: "Ana L", email: "ANA@example.com" }, two)).toHaveLength(2);
  });

  it("refuses signups without a valid email", () => {
    expect(() => subscribe({ name: "Ana", email: "not-an-email" }, [])).toThrow();
    expect(() => subscribe({ name: "Ana" }, [])).toThrow();
  });

  it("defines the subscriber shape in packages/schemas, not in the module", () => {
    // Contracts live in packages/schemas so every module and agent shares one definition.
    const known = ["Member", "Event", "Application", "Sponsor"];
    const added = Object.keys(schemas.sharedSchemas).filter((k) => !known.includes(k));
    expect(added.length, "a new shared schema registered in sharedSchemas").toBeGreaterThan(0);
    const manifest = JSON.parse(read(`${dir}/module.json`));
    expect(added.some((k) => manifest.provides.schemas.includes(k)), "manifest provides the shared schema").toBe(true);
    expect(sources()).not.toMatch(/z\.object\(\{[^}]*\bemail\b/s);
  });

  it("is a working module", () => {
    const manifest = JSON.parse(read(`${dir}/module.json`));
    expect(manifest.status).not.toBe("planned");
    expect(manifest.verify).toBeTruthy();
    expect(manifest.provides.exports).toContain("subscribe");
  });

  it("stores subscribers where the anon key cannot read them", () => {
    expect(existsSync(`${dir}/migrations`)).toBe(true);
    const sql = readdirSync(`${dir}/migrations`)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => read(`${dir}/migrations/${f}`))
      .join("\n")
      .toLowerCase()
      .replace(/--[^\n]*/g, "");
    expect(sql).toContain("enable row level security");
    const statements = sql.split(";");
    // Inserting from the browser is a fair design; reading or changing the list with the anon key is not.
    const readable = statements.filter(
      (s) =>
        /create policy/.test(s) &&
        !/\bfor\s+insert\b/.test(s) &&
        (/\bto\s[^;]*\b(anon|public)\b/.test(s) || !/\bto\s/.test(s.replace(/\b(using|with check)[\s\S]*/, ""))),
    );
    expect(readable).toEqual([]);
    expect(statements.filter((s) => /\bgrant\s[^;]*\b(select|update|delete|all)\b[^;]*\bto\s[^;]*\b(anon|public)\b/.test(s))).toEqual([]);
  });
});
