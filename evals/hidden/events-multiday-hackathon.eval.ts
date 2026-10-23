// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { describe, expect, it } from "vitest";
import { eventToIcs } from "../modules/events/src/index";

const base = { id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", name: "Hackathon", description: "", date: "2026-11-13" };

describe("hidden: multi-day events", () => {
  it("ends a 48-hour event two days later", () => {
    expect(eventToIcs({ ...base, startTime: "18:00", durationMinutes: 48 * 60 })).toContain(
      "DTEND;TZID=America/Toronto:20261115T180000",
    );
  });

  it("handles events spanning a month boundary", () => {
    const ics = eventToIcs({ ...base, date: "2026-11-29", startTime: "09:30", durationMinutes: 72 * 60 + 45 });
    expect(ics).toContain("DTEND;TZID=America/Toronto:20261202T101500");
  });

  it("keeps same-day and overnight events correct", () => {
    expect(eventToIcs({ ...base, startTime: "19:00", durationMinutes: 90 })).toContain("DTEND;TZID=America/Toronto:20261113T203000");
    expect(eventToIcs({ ...base, startTime: "23:00", durationMinutes: 120 })).toContain("DTEND;TZID=America/Toronto:20261114T010000");
  });
});
