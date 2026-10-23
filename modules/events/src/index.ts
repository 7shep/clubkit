import { EventSchema, type Event } from "@clubkit/schemas";

/** Validate untrusted input (form data, agent output, a database row) into an Event. Throws ZodError on bad input. */
export function parseEvent(input: unknown): Event {
  return EventSchema.parse(input);
}

/** Events on or after `today` (YYYY-MM-DD), soonest first; same-day events order by start time. */
export function upcomingEvents(events: Event[], today: string): Event[] {
  return events
    .filter((event) => event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));
}

/** Remaining RSVP spots, or `null` when the event has no cap. Never negative. */
export function rsvpSpotsLeft(event: Event, rsvpCount: number): number | null {
  if (event.rsvpCap === undefined) return null;
  return Math.max(0, event.rsvpCap - rsvpCount);
}

const escapeIcs = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/**
 * Render a single-event iCalendar file. Timed events use floating local time in
 * `timezone`; events without a start time become all-day events.
 */
export function eventToIcs(event: Event, timezone = "America/Toronto"): string {
  const day = event.date.replace(/-/g, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//clubkit//events//EN", "BEGIN:VEVENT", `UID:${event.id}@clubkit`];

  if (event.startTime) {
    const [hours, minutes] = event.startTime.split(":").map(Number);
    const start = new Date(Date.UTC(2000, 0, 1, hours, minutes));
    const end = new Date(start.getTime() + (event.durationMinutes ?? 60) * 60_000);
    const hhmm = (d: Date) => `${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}00`;
    // Events that run past midnight end on the following day.
    const endDay = end.getUTCDate() > 1 ? nextDay(event.date) : day;
    lines.push(`DTSTART;TZID=${timezone}:${day}T${hhmm(start)}`, `DTEND;TZID=${timezone}:${endDay}T${hhmm(end)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${nextDay(event.date)}`);
  }

  lines.push(`SUMMARY:${escapeIcs(event.name)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

function nextDay(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}
