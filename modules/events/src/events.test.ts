import { describe, expect, it } from "vitest";
import type { Event } from "@clubkit/schemas";
import { eventToIcs, parseEvent, rsvpSpotsLeft, upcomingEvents } from "./index";

const base: Event = {
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  name: "Hack Night",
  description: "Build anything",
  date: "2026-11-05",
};

describe("events", () => {
  it("rejects malformed dates and times", () => {
    expect(() => parseEvent({ ...base, date: "Nov 5" })).toThrow();
    expect(() => parseEvent({ ...base, startTime: "7pm" })).toThrow();
    expect(parseEvent({ ...base, startTime: "19:00" }).startTime).toBe("19:00");
  });

  it("lists upcoming events soonest first, including today", () => {
    const events: Event[] = [
      { ...base, name: "later", date: "2026-12-01" },
      { ...base, name: "past", date: "2026-10-01" },
      { ...base, name: "today-late", date: "2026-10-22", startTime: "20:00" },
      { ...base, name: "today-early", date: "2026-10-22", startTime: "09:00" },
    ];
    expect(upcomingEvents(events, "2026-10-22").map((e) => e.name)).toEqual(["today-early", "today-late", "later"]);
  });

  it("reports RSVP capacity without going negative", () => {
    expect(rsvpSpotsLeft(base, 10)).toBeNull();
    expect(rsvpSpotsLeft({ ...base, rsvpCap: 100 }, 40)).toBe(60);
    expect(rsvpSpotsLeft({ ...base, rsvpCap: 100 }, 120)).toBe(0);
  });

  it("exports timed, overnight, and all-day events to iCalendar", () => {
    const timed = eventToIcs({ ...base, startTime: "19:00", durationMinutes: 90, location: "Goodwin Hall, Room 247" });
    expect(timed).toContain("DTSTART;TZID=America/Toronto:20261105T190000");
    expect(timed).toContain("DTEND;TZID=America/Toronto:20261105T203000");
    expect(timed).toContain("LOCATION:Goodwin Hall\\, Room 247");

    const overnight = eventToIcs({ ...base, startTime: "23:00", durationMinutes: 120 });
    expect(overnight).toContain("DTEND;TZID=America/Toronto:20261106T010000");

    const allDay = eventToIcs({ ...base, date: "2026-12-31" });
    expect(allDay).toContain("DTSTART;VALUE=DATE:20261231");
    expect(allDay).toContain("DTEND;VALUE=DATE:20270101");
  });
});
