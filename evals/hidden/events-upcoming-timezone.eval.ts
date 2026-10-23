// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { describe, expect, it } from "vitest";
import { upcomingEventsAt } from "../modules/events/src/index";

const base = { id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", description: "" };
const events = [
  { ...base, name: "yesterday", date: "2026-11-04" },
  { ...base, name: "today-late", date: "2026-11-05", startTime: "20:00" },
  { ...base, name: "today-early", date: "2026-11-05", startTime: "09:00" },
  { ...base, name: "tomorrow", date: "2026-11-06" },
  { ...base, name: "next-month", date: "2026-12-01" },
];
const names = (list: { name: string }[]) => list.map((e) => e.name);

describe("hidden: upcoming events from an instant and a timezone", () => {
  it("uses the club's date when UTC has already rolled over (Toronto evening)", () => {
    // 2026-11-06T03:30Z is 22:30 on Nov 5 in Toronto.
    expect(names(upcomingEventsAt(events, new Date("2026-11-06T03:30:00Z"), "America/Toronto"))).toEqual([
      "today-early", "today-late", "tomorrow", "next-month",
    ]);
  });

  it("uses the club's date when it is ahead of UTC (Tokyo morning)", () => {
    // 2026-11-05T16:00Z is 01:00 on Nov 6 in Tokyo.
    expect(names(upcomingEventsAt(events, new Date("2026-11-05T16:00:00Z"), "Asia/Tokyo"))).toEqual(["tomorrow", "next-month"]);
  });

  it("matches UTC when the club is on UTC", () => {
    expect(names(upcomingEventsAt(events, new Date("2026-11-05T12:00:00Z"), "UTC"))).toEqual([
      "today-early", "today-late", "tomorrow", "next-month",
    ]);
  });

  it("handles the day daylight saving ends", () => {
    // Clocks fall back at 06:00Z on Nov 1. 04:30Z is 00:30 EDT on Nov 1; 03:30Z is 23:30 EDT on Oct 31.
    const dstDay = [{ ...base, name: "oct-31", date: "2026-10-31" }, { ...base, name: "nov-1", date: "2026-11-01" }];
    expect(names(upcomingEventsAt(dstDay, new Date("2026-11-01T04:30:00Z"), "America/Toronto"))).toEqual(["nov-1"]);
    expect(names(upcomingEventsAt(dstDay, new Date("2026-11-01T03:30:00Z"), "America/Toronto"))).toEqual(["oct-31", "nov-1"]);
  });
});
