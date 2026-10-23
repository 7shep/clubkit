// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { weeklyOccurrences } from "../modules/events/src/index";

const workshop = {
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  name: "Thursday Workshop",
  description: "Weekly build session",
  date: "2026-10-01",
  startTime: "18:30",
  durationMinutes: 90,
  location: "Goodwin Hall 247",
};

describe("hidden: weekly recurring events", () => {
  it("runs every Thursday until Dec 4, across the daylight saving change", () => {
    expect(weeklyOccurrences(workshop, "2026-12-04").map((e) => e.date)).toEqual([
      "2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22", "2026-10-29",
      "2026-11-05", "2026-11-12", "2026-11-19", "2026-11-26", "2026-12-03",
    ]);
  });

  it("includes the last date when it falls on the same weekday", () => {
    expect(weeklyOccurrences(workshop, "2026-10-15").map((e) => e.date)).toEqual(["2026-10-01", "2026-10-08", "2026-10-15"]);
    expect(weeklyOccurrences(workshop, "2026-10-01").map((e) => e.date)).toEqual(["2026-10-01"]);
  });

  it("returns nothing when the series ends before it starts", () => {
    expect(weeklyOccurrences(workshop, "2026-09-30")).toEqual([]);
  });

  it("crosses a year boundary", () => {
    const dates = weeklyOccurrences({ ...workshop, date: "2026-12-24" }, "2027-01-14").map((e) => e.date);
    expect(dates).toEqual(["2026-12-24", "2026-12-31", "2027-01-07", "2027-01-14"]);
  });

  it("keeps every other field on each occurrence", () => {
    for (const occurrence of weeklyOccurrences(workshop, "2026-11-30")) {
      expect(occurrence).toMatchObject({
        name: workshop.name,
        description: workshop.description,
        startTime: "18:30",
        durationMinutes: 90,
        location: workshop.location,
      });
    }
    expect(workshop.date).toBe("2026-10-01");
  });

  it("is listed as a public export", () => {
    expect(JSON.parse(readFileSync("modules/events/module.json", "utf8")).provides.exports).toContain("weeklyOccurrences");
  });
});
