# Knox Tracker — Changelog

## 2.1 — Jul 27, 2026
**Added — Hotel and rental car reservations**
- Every trip can now capture a hotel (brand, price, confirmation #, check-in/check-out) and a rental car (company, price, confirmation #, pickup/dropoff dates) alongside the flight.
- Loyalty numbers auto-fill from the traveler's profile in Ehlo — no retyping.
- Today's Board now shows a green ✓ or red ✗ for Hotel and Car on every trip — click either one (when booked) to expand the full reservation details inline.
- All three (flight, hotel, car) now flow to Ehlo's Billing automatically once a trip is marked "Booked & Confirmed," each with the correct booking fee for that client's plan.
- Fixed a related edge case from the fee-linking system: deleting a trip with multiple linked Ehlo entries (flight + hotel + car) now handles all of them correctly instead of assuming there's only one.

## 2.0 — Jul 27, 2026
**Added**
- Ticket price capture: marking a trip "Booked & Confirmed" now asks for the actual ticket price (right when staff have it in front of them from booking the flight). This completes the auto-billing loop — Ehlo now receives the real ticket cost automatically, not a $0 placeholder someone had to fill in by hand later.
- Editing a trip's ticket price after the fee was already logged keeps Ehlo's billing entry in sync automatically.

## 1.9 — Jul 27, 2026
**Fixed**
- Orphaned billing entries: deleting a trip that already had its booking fee auto-logged to Ehlo used to leave that fee sitting there with nothing cleaning it up. Now, deleting a trip checks the linked Ehlo entry first — if it's still untouched ($0, nobody's added the real ticket cost yet), it gets removed along with the trip. If someone already entered a real number, it's never silently deleted — instead a client note flags it for manual review.

## 1.8 — Jul 25, 2026
**Added — cross-system features with Ehlo Client**
- Auto-logged booking fees: when a trip becomes "Booked & Confirmed" for a real client, the standard booking fee is automatically logged to Ehlo's Billing, along with a client note flagging that the actual ticket cost still needs to be entered (Knox doesn't capture ticket price).
- Client budget hint: selecting a company on Add Trip now shows how much of their monthly threshold is used so far, color-coded the same way Ehlo shows it.
- Traveler trip history: selecting a traveler shows how many trips they've taken this year.
- Disruption flag: a "Flag disruption" button on every trip lets staff note what went wrong — this creates a client note in Ehlo so the extra cost doesn't get forgotten during billing review.

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
