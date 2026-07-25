# Knox Tracker — Changelog

## 1.1 — Jul 25, 2026
**Added**
- Version tag now shown in the top bar next to the Knox logo, so it's always clear which version is live.
- Add Trip form now has a **Company** dropdown instead of manual text entry — selecting a company auto-fills Client #, Plan tier, and how long they've been a OneStone client.
- **Traveler** dropdown, scoped to whichever company is selected, with a "+ Add new traveler" option that saves the new name for next time.
- **Airline** dropdown (with an "Other" option for anything not listed), replacing free-text entry.

**Changed**
- Client company data is now shared live with Ehlo Client (OneStone's internal client/billing system) — a new company added in Ehlo shows up in Knox Tracker's dropdown automatically, with no manual re-entry.
- The Company dropdown now only shows **active** clients. If a client ends service with OneStone (tracked in Ehlo), they stop appearing as an option for new trips — existing/past trips for them are unaffected.

## 1.0 — Initial release
**Added**
- Daily Client Tracker: add a trip (client, airline, flight #, departure time, duration), see today's board with live status.
- Automatic flight status updates via FlightAware AeroAPI — phase (scheduled/taxiing/in the air/landed), ETA, gate, terminal, and route progress, refreshed automatically.
- Manual status override with staff attribution and timestamp, plus a "resume auto-updates" option.
- Future Trips section — upcoming trips for the rest of the current month in one table.
- Disruption Tool — decision-support reference for flight, hotel, rental car, and other travel disruptions, plus a Drive vs. Fly calculator.
- Per-trip Notes — timestamped, staff-attributed notes so the next person picking up a trip has context.
- Owner-only access controls shared with Ehlo Client via a common staff role system.
