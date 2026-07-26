# Knox Tracker — Changelog

## 1.7 — Jul 25, 2026
**Changed**
- Google flight lookup simplified back down to just "[airline code] [flight number]" (e.g. "AA 887") — the earlier version added route and date to the search, but that extra detail was actually making results less accurate, not more.

## 1.6 — Jul 25, 2026
**Added**
- Departure time is now a scrollable dropdown (15-minute increments) instead of the native time picker, on both Add Trip and the new Edit Trip modal.
- **Edit Trip** — every trip on the board now has a real Edit button, letting staff correct traveler name, airline, flight number, route, departure time, duration, and booking status after the fact, instead of only being able to change the date or delete and re-add the whole trip.

## 1.5 — Jul 25, 2026
**Added**
- Airline code now auto-fills based on the selected airline (e.g. picking "American" fills in "AA") — editable if it's ever wrong, and manual for "Other."
- Flight # field is now just the number (e.g. "887") instead of the whole code — the two combine automatically into the full flight identifier (e.g. "AA887") used for saving the trip, the FlightAware lookup, and the Google search button.

## 1.4 — Jul 25, 2026
**Improved**
- Google flight lookup now combines everything we already know — airline, route (from → to), and date — into one search query (e.g. "American AA887 flight status PHX to DFW July 25, 2026"), instead of just flight number and date. Trip rows prefer the FlightAware-confirmed route over the manually typed one, once it's available.

## 1.3 — Jul 25, 2026
**Fixed**
- Google flight lookup now includes the trip's actual date in the search (e.g. "AA887 flight status July 25, 2026") instead of just the flight number alone — since flight numbers repeat daily, this avoids accidentally surfacing a different day's flight with the same number.

## 1.2 — Jul 25, 2026
**Added**
- Google flight lookup — a small 🔎 button on the Add Trip form (next to Flight #) and on every existing trip row, opening a live Google search for that flight's current status in a new tab. No API cost, just a quick second opinion alongside FlightAware's automated data.

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
