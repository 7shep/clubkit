// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EventSchema } from "../packages/schemas/src/index";
import { eventSponsors } from "../modules/sponsors/src/index";

const acme = { id: "5d1c9a7e-2b4f-4c6a-8e0d-3f5b7a9c1e2d", name: "Acme", tier: "gold" };
const zeta = { id: "9b2f8d1e-1c4a-4f6e-8a3b-2d5c7e9f1a0b", name: "Zeta", tier: "silver" };
const mid = { id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301", name: "Mid" };
const hackathon = {
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  name: "Hackathon",
  description: "48 hours",
  date: "2026-11-13",
  startTime: "18:00",
  sponsorIds: [zeta.id, acme.id],
};

describe("hidden: event page sponsors", () => {
  it("lets an event list its sponsors by id", () => {
    expect(EventSchema.safeParse(hackathon).success).toBe(true);
    expect(EventSchema.safeParse({ ...hackathon, sponsorIds: undefined }).success).toBe(true);
    expect(EventSchema.safeParse({ ...hackathon, sponsorIds: ["acme"] }).success).toBe(false);
  });

  it("returns the event's sponsors in the event's order", () => {
    expect(eventSponsors(hackathon, [acme, mid, zeta]).map((s: { name: string }) => s.name)).toEqual(["Zeta", "Acme"]);
  });

  it("skips ids with no matching sponsor and handles events without sponsors", () => {
    const missing = "0b6f2b5e-3a3c-4d8e-9f0a-1c2d3e4f5a6b";
    expect(eventSponsors({ ...hackathon, sponsorIds: [missing, acme.id] }, [acme, zeta]).map((s: { name: string }) => s.name)).toEqual(["Acme"]);
    const { sponsorIds: _ids, ...plain } = hackathon;
    expect(eventSponsors(plain, [acme, zeta])).toEqual([]);
  });

  it("promotes sponsors to a working module and stores the link on events", () => {
    const sponsors = JSON.parse(readFileSync("modules/sponsors/module.json", "utf8"));
    expect(sponsors.status).not.toBe("planned");
    expect(sponsors.verify).toBeTruthy();
    expect(sponsors.provides.exports).toContain("eventSponsors");

    const sql = ["modules/events/migrations", "modules/sponsors/migrations"]
      .filter((dir) => existsSync(dir))
      .flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith(".sql")).map((f) => readFileSync(`${dir}/${f}`, "utf8")))
      .join("\n")
      .toLowerCase();
    expect(sql).toMatch(/sponsor\w*\s+uuid|references\s+(public\.)?sponsors/);
  });
});
