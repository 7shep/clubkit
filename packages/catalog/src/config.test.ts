import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ClubConfigSchema, type ClubConfig } from "@clubkit/schemas";
import { checkModuleConfig, findApprover, loadClubConfig, loadModules, moduleConfig, repoRoot } from "./index";

const { modules } = loadModules();
const manifest = (name: string) => modules.find((m) => m.manifest.name === name)!.manifest;
const base = { name: "Test Club", timezone: "America/Toronto", approvers: [{ name: "Priya Shah" }] };
const config = (extra: Record<string, unknown> = {}): ClubConfig => ClubConfigSchema.parse({ ...base, ...extra });

function writeTemp(value: unknown): string {
  const path = join(mkdtempSync(join(tmpdir(), "clubkit-config-")), "club.config.json");
  writeFileSync(path, typeof value === "string" ? value : JSON.stringify(value));
  return path;
}

describe("club config", () => {
  it("accepts the committed example against the real module manifests", () => {
    const result = loadClubConfig(join(repoRoot, "club.config.example.json"), modules);
    expect(result.problems).toEqual([]);
    expect(result.config?.approvers.length).toBeGreaterThan(0);
  });

  it("rejects a bad timezone, no approvers, duplicate approvers, and unknown fields, naming each", () => {
    const problems = (value: unknown) => loadClubConfig(writeTemp(value), modules).problems.map((p) => p.message).join("\n");
    expect(problems({ ...base, timezone: "Toronto" })).toMatch(/timezone: Expected an IANA timezone/);
    expect(problems({ ...base, approvers: [] })).toMatch(/approvers: List at least one exec/);
    expect(problems({ ...base, approvers: [{ name: "Priya" }, { name: " priya" }] })).toMatch(/approvers\.1\.name: Approver "priya" is listed twice/);
    expect(problems({ ...base, timezoen: "UTC" })).toMatch(/Unrecognized key.*timezoen/);
    expect(problems("{ nope")).toMatch(/not valid JSON/);
    expect(loadClubConfig(join(tmpdir(), "missing-club.config.json"), modules).problems[0].message).toMatch(/does not exist/);
  });

  it("checks module settings against manifests: unknown module, unknown key, wrong type", () => {
    const messages = checkModuleConfig(
      config({ modules: { evnts: { timezone: "UTC" }, events: { tz: "UTC" }, applications: { resumeMaxBytes: "8MB" } } }),
      modules,
    ).map((p) => p.message);
    expect(messages).toEqual([
      expect.stringMatching(/^modules\.evnts: no module named "evnts"\. Known modules: .*events/),
      'modules.events.tz: events has no setting "tz". Allowed: timezone',
      'modules.applications.resumeMaxBytes: expected a number, got "8MB"',
    ]);
  });

  it("reports required settings that resolve to nothing", () => {
    const events = modules.find((m) => m.manifest.name === "events")!;
    const strict = { ...events, manifest: { ...events.manifest, config: { region: { type: "string" as const, description: "Where events happen", required: true } } } };
    expect(checkModuleConfig(config(), [strict]).map((p) => p.message)).toEqual(["modules.events.region is required: Where events happen"]);
    expect(checkModuleConfig(config({ modules: { events: { region: "Kingston" } } }), [strict])).toEqual([]);
  });

  it("resolves module settings: explicit, then same-named club field, then manifest default", () => {
    expect(moduleConfig(config({ timezone: "America/Vancouver" }), manifest("events"))).toEqual({ timezone: "America/Vancouver" });
    expect(moduleConfig(config({ modules: { events: { timezone: "UTC" } } }), manifest("events"))).toEqual({ timezone: "UTC" });
    expect(moduleConfig(config(), manifest("applications"))).toEqual({ resumeMaxBytes: 8388608 });
  });

  it("knows who may approve, ignoring case and spaces", () => {
    expect(findApprover(config(), "  priya shah ")?.name).toBe("Priya Shah");
    expect(findApprover(config(), "Claude")).toBeUndefined();
  });
});
