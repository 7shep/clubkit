// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nextEvents } from "../modules/events/src/index";

const base = { id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", description: "" };
const names = (list: { name: string }[]) => list.map((e) => e.name);

describe("hidden: next events on the homepage", () => {
  it("returns the soonest events first, at most `count`", () => {
    const events = [
      { ...base, name: "dec", date: "2026-12-01", startTime: "18:00" },
      { ...base, name: "nov-20", date: "2026-11-20", startTime: "18:00" },
      { ...base, name: "past", date: "2026-10-01", startTime: "18:00" },
      { ...base, name: "nov-12", date: "2026-11-12", startTime: "18:00" },
      { ...base, name: "nov-12-early", date: "2026-11-12", startTime: "09:00" },
    ];
    const now = new Date("2026-11-01T16:00:00Z");
    expect(names(nextEvents(events, now, 3))).toEqual(["nov-12-early", "nov-12", "nov-20"]);
    expect(names(nextEvents(events, now, 10))).toEqual(["nov-12-early", "nov-12", "nov-20", "dec"]);
  });

  it("uses the club's timezone, not the server's UTC clock", () => {
    // The server runs in UTC. 2026-11-06T03:30Z is 22:30 on Nov 5 at the club (America/Toronto,
    // the module's configured timezone), so tonight's 23:30 social hasn't happened yet.
    const events = [
      { ...base, name: "tonight", date: "2026-11-05", startTime: "23:30" },
      { ...base, name: "tomorrow", date: "2026-11-06", startTime: "18:00" },
    ];
    expect(names(nextEvents(events, new Date("2026-11-06T03:30:00Z"), 3))).toEqual(["tonight", "tomorrow"]);
  });

  it("starts the club's next day at its own midnight", () => {
    // 2026-11-05T04:30Z is 23:30 on Nov 4 in Toronto: nothing on Nov 4 is in the past yet.
    const events = [
      { ...base, name: "nov-4-late", date: "2026-11-04", startTime: "23:45" },
      { ...base, name: "nov-5", date: "2026-11-05", startTime: "12:00" },
    ];
    expect(names(nextEvents(events, new Date("2026-11-05T04:30:00Z"), 3))).toEqual(["nov-4-late", "nov-5"]);
  });

  it("is listed as a public export", () => {
    expect(JSON.parse(readFileSync("modules/events/module.json", "utf8")).provides.exports).toContain("nextEvents");
  });
});
