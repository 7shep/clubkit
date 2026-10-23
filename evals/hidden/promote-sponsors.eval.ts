// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sponsorsByTier } from "../modules/sponsors/src/index";

const sponsor = (name: string, tier?: string) => ({
  id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  name,
  ...(tier === undefined ? {} : { tier }),
});

describe("hidden: sponsors module", () => {
  it("groups by tier order, sorts by name, drops empty tiers, and puts leftovers in 'other'", () => {
    const result = sponsorsByTier(
      [sponsor("Zeta", "gold"), sponsor("Acme", "gold"), sponsor("Mid", "silver"), sponsor("Loose"), sponsor("Odd", "diamond")],
      ["platinum", "gold", "silver"],
    );
    expect(result.map((g: { tier: string; sponsors: { name: string }[] }) => [g.tier, g.sponsors.map((s) => s.name)])).toEqual([
      ["gold", ["Acme", "Zeta"]],
      ["silver", ["Mid"]],
      ["other", ["Loose", "Odd"]],
    ]);
  });

  it("omits 'other' when every sponsor has a known tier", () => {
    expect(sponsorsByTier([sponsor("A", "gold")], ["gold"]).map((g: { tier: string }) => g.tier)).toEqual(["gold"]);
  });

  it("is a working module with a public-read table", () => {
    const manifest = JSON.parse(readFileSync("modules/sponsors/module.json", "utf8"));
    expect(manifest.status).not.toBe("planned");
    expect(manifest.verify).toBeTruthy();
    expect(manifest.provides.exports).toContain("sponsorsByTier");
    expect(manifest.provides.migrations.length).toBeGreaterThan(0);

    const dir = "modules/sponsors/migrations";
    expect(existsSync(dir)).toBe(true);
    const sql = readdirSync(dir)
      .map((f) => readFileSync(`${dir}/${f}`, "utf8"))
      .join("\n")
      .toLowerCase();
    expect(sql).toContain("enable row level security");
    expect(sql).toMatch(/for select[\s\S]*to anon/);
  });
});
