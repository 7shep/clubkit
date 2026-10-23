# events

Club events: storage, upcoming-event queries, RSVP capacity, and calendar export.

## Use it for

- Adding or publishing an event (validate with `parseEvent` first).
- Showing "what's next" on a club site (`upcomingEvents(events, today)`).
- Checking whether an event is full (`rsvpSpotsLeft(event, rsvpCount)`).
- Giving members an "Add to calendar" file (`eventToIcs(event, timezone)`).

## Contract

Shape: `Event` from `@clubkit/schemas`. Dates are `YYYY-MM-DD`; start times are
24-hour `HH:MM` in the club's configured `timezone`. An event with no
`startTime` is all-day. An event with no `rsvpCap` is uncapped.

Storage: `migrations/0001_events.sql` creates `public.events` with public read
access. Only the service role can write, so publishing must happen server-side.

## Rules for agents

- Never write events from browser code with the anon key; the table forbids it.
- Pass `today` explicitly to `upcomingEvents` in the club's timezone rather than
  relying on the server clock.
- After changing this module, run `pnpm verify events`.

## Not yet included

RSVP storage, reminders, and recurring events.
