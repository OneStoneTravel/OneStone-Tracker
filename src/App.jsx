import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import DisruptionTool from "./DisruptionTool";
import TripNotes from "./TripNotes";
import Requests from "./Requests";

const DAY_START = 0;
const DAY_END = 24;

const STATUS_META = {
  ontime: { label: "On time", color: "#2F6B4F", bg: "#E9F3EC" },
  delayed: { label: "Delayed", color: "#9A6B15", bg: "#FCF4E3" },
  cancelled: { label: "Cancelled", color: "#B0432F", bg: "#FBECE9" },
};

const BOOKING_META = {
  pending: { label: "Pending", className: "pending" },
  working: { label: "Agent Working On It", className: "working" },
  booked: { label: "Booked & Confirmed", className: "booked" },
};

const AIRLINES = [
  "American", "United", "Delta", "Southwest", "JetBlue",
  "Alaska", "Spirit", "Frontier", "Allegiant", "Hawaiian", "Other",
];

const AIRLINE_CODES = {
  American: "AA", United: "UA", Delta: "DL", Southwest: "WN", JetBlue: "B6",
  Alaska: "AS", Spirit: "NK", Frontier: "F9", Allegiant: "G4", Hawaiian: "HA",
};

const HOTEL_BRANDS = ["Marriott", "Hilton", "Hyatt", "IHG (Holiday Inn/InterContinental)", "Best Western", "Choice Hotels", "Wyndham", "Other"];
const CAR_COMPANIES = ["Hertz", "Enterprise", "Avis", "Budget", "National", "Alamo", "Other"];

// Matches Ehlo's plan tier "other" booking fee rate (hotel/car), so fees
// auto-logged from Knox stay consistent with Ehlo's own rate schedule.
const KNOX_OTHER_FEE_RATES = { Starter: 25, Growth: 20, Premier: 15, Anchor: 32 };

// Matches Ehlo's plan tier flight-booking fee rates, so the auto-logged fee
// is consistent between the two systems.
const KNOX_FLIGHT_FEE_RATES = { Starter: 40, Growth: 35, Premier: 30, Anchor: 32 };

// When a trip becomes "Booked & Confirmed" for a real client, log the booking
// fee to Ehlo automatically. The actual ticket cost isn't captured in Knox,
// so a client note flags that it still needs to be entered.
async function logBookingFeeToEhlo(trip, session) {
  const flightFee = KNOX_FLIGHT_FEE_RATES[trip.plan_tier] ?? 32;
  const otherFee = KNOX_OTHER_FEE_RATES[trip.plan_tier] ?? 32;
  const ticketPrice = Number(trip.ticket_price) || 0;
  const noteLines = [];

  await supabase.from("client_expenses").insert({
    client_id: trip.client_id,
    traveler_name: trip.client_name,
    category: "Flight",
    amount: ticketPrice,
    fee: flightFee,
    entry_date: trip.travel_date,
    created_by: session.user.email,
    source_trip_id: trip.id,
  });
  noteLines.push(`Ticket cost ($${ticketPrice.toFixed(2)}) and booking fee ($${flightFee}) logged.`);

  if (trip.has_hotel && trip.hotel_price) {
    await supabase.from("client_expenses").insert({
      client_id: trip.client_id,
      traveler_name: trip.client_name,
      category: "Hotel",
      amount: Number(trip.hotel_price) || 0,
      fee: otherFee,
      entry_date: trip.travel_date,
      created_by: session.user.email,
      source_trip_id: trip.id,
    });
    noteLines.push(`Hotel (${trip.hotel_brand}, conf# ${trip.hotel_confirmation || "—"}): $${Number(trip.hotel_price).toFixed(2)} + $${otherFee} fee logged.`);
  }

  if (trip.has_car && trip.car_price) {
    await supabase.from("client_expenses").insert({
      client_id: trip.client_id,
      traveler_name: trip.client_name,
      category: "Car",
      amount: Number(trip.car_price) || 0,
      fee: otherFee,
      entry_date: trip.travel_date,
      created_by: session.user.email,
      source_trip_id: trip.id,
    });
    noteLines.push(`Rental car (${trip.car_company}, conf# ${trip.car_confirmation || "—"}): $${Number(trip.car_price).toFixed(2)} + $${otherFee} fee logged.`);
  }

  await supabase.from("client_notes").insert({
    client_id: trip.client_id,
    note: `Trip booked in Knox Tracker: ${trip.client_name}, ${trip.airline} ${trip.flight_number} on ${trip.travel_date}. ${noteLines.join(" ")}`,
    created_by: session.user.email,
  });
}

function generateTimeOptions() {
  const opts = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const hr12 = h % 12 === 0 ? 12 : h % 12;
      const ampm = h < 12 ? "AM" : "PM";
      const label = `${hr12}:${String(m).padStart(2, "0")} ${ampm}`;
      opts.push({ value, label });
    }
  }
  return opts;
}
const TIME_OPTIONS = generateTimeOptions();

function tenureLabel(dateJoined) {
  if (!dateJoined) return "";
  const start = new Date(dateJoined + "T00:00:00");
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months < 1) return "Client since this month";
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const parts = [];
  if (years > 0) parts.push(`${years}yr`);
  if (remMonths > 0 || years === 0) parts.push(`${remMonths}mo`);
  return `Client for ${parts.join(" ")}`;
}

function fmtHour(h) {
  const hr = Math.floor(h) % 12 === 0 ? 12 : Math.floor(h) % 12;
  const m = Math.round((h % 1) * 60);
  const ampm = h < 12 || h >= 24 ? "am" : "pm";
  return m === 0 ? `${hr}${ampm}` : `${hr}:${String(m).padStart(2, "0")}${ampm}`;
}

function timeToDecimal(timeStr) {
  const [hh, mm] = timeStr.split(":").map(Number);
  return hh + mm / 60;
}

// Never use toISOString() for "today" — it returns UTC, so after 5pm in
// Phoenix it rolls to tomorrow. Build the date string from local parts.
function localDateStr(d) {
  d = d || new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function googleFlightSearch(query) {
  if (!query) return;
  window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
}

// Existing trips store flight_number as one combined string like "AA887" —
// split it back into "AA 887" for a cleaner search.
function spacedFlightNumber(flightNumber) {
  if (!flightNumber) return flightNumber;
  const match = flightNumber.match(/^([A-Za-z]+)\s*(\d+)$/);
  return match ? `${match[1]} ${match[2]}` : flightNumber;
}

function prettyDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="knox-logo login-logo">
          KN<span>O</span>X
        </div>
        <p className="sub">OneStone Staff System</p>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        <label>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}

function emptyForm() {
  return {
    client_id: "",
    traveler_choice: "",
    new_traveler_name: "",
    from_code: "",
    to_code: "",
    airline_choice: "",
    airline_other: "",
    airline_code: "",
    flight_number: "",
    departure_time: "09:00",
    duration_hours: 2.5,
    booking_status: "pending",
    ticket_price: "",
    has_hotel: "no",
    hotel_brand: "",
    hotel_price: "",
    hotel_confirmation: "",
    hotel_checkin: "",
    hotel_checkout: "",
    has_car: "no",
    car_company: "",
    car_price: "",
    car_confirmation: "",
    car_pickup_date: "",
    car_dropoff_date: "",
  };
}

function TripForm({ date, onAdd, clients, travelers }) {
  const [form, setForm] = useState(emptyForm());
  const [budgetInfo, setBudgetInfo] = useState(null);
  const [travelerTripCount, setTravelerTripCount] = useState(null);

  const selectedClient = clients.find((c) => c.id === form.client_id);
  const clientTravelers = travelers.filter((t) => t.client_id === form.client_id);
  const selectedTraveler = clientTravelers.find((t) => t.name === form.traveler_choice);

  useEffect(() => {
    async function loadBudget() {
      if (!form.client_id || !selectedClient) { setBudgetInfo(null); return; }
      const monthStart = localDateStr().slice(0, 7) + "-01";
      const { data } = await supabase
        .from("client_expenses")
        .select("amount, category")
        .eq("client_id", form.client_id)
        .neq("category", "Booking Fee")
        .gte("entry_date", monthStart);
      const spend = (data || []).reduce((s, e) => s + Number(e.amount), 0);
      const threshold = selectedClient.monthly_threshold || 0;
      const pct = threshold > 0 ? Math.round((spend / threshold) * 100) : 0;
      setBudgetInfo({ spend, threshold, pct });
    }
    loadBudget();
  }, [form.client_id]);

  useEffect(() => {
    async function loadTravelerHistory() {
      if (!form.traveler_choice || form.traveler_choice === "__new__") { setTravelerTripCount(null); return; }
      const yearStart = `${new Date().getFullYear()}-01-01`;
      const { count } = await supabase
        .from("trips")
        .select("id", { count: "exact", head: true })
        .eq("client_name", form.traveler_choice)
        .gte("travel_date", yearStart);
      setTravelerTripCount(count || 0);
    }
    loadTravelerHistory();
  }, [form.traveler_choice]);

  async function submit(e) {
    e.preventDefault();
    await onAdd(form, date);
    setForm(emptyForm());
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="panel">
      <h2>Add a client trip</h2>
      <form className="trip-form" onSubmit={submit}>
        <div>
          <label>Company</label>
          <select required value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value, traveler_choice: "" })}>
            <option value="">Select a company…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </div>
        <div>
          <label>Client #</label>
          <input disabled value={selectedClient?.client_number || ""} placeholder="—" />
        </div>
        <div>
          <label>Plan</label>
          <input disabled value={selectedClient?.plan_tier || ""} placeholder="—" />
        </div>
        <div>
          <label>Client tenure</label>
          <input disabled value={selectedClient ? tenureLabel(selectedClient.date_joined) : ""} placeholder="—" />
        </div>
        <div>
          <label>Budget this month</label>
          {budgetInfo ? (
            <div style={{
              padding: "9px 10px", fontSize: 12.5, fontWeight: 600, borderRadius: 6, border: "1px solid var(--line)",
              color: budgetInfo.pct >= 90 ? "#B0432F" : budgetInfo.pct >= 75 ? "#B5651D" : budgetInfo.pct >= 50 ? "#9A6B15" : "#2F6B4F",
            }}>
              {budgetInfo.pct}% used (${budgetInfo.spend.toLocaleString()} of ${budgetInfo.threshold.toLocaleString()})
            </div>
          ) : (
            <input disabled value="" placeholder="—" />
          )}
        </div>
        <div>
          <label>Traveler</label>
          <select required value={form.traveler_choice} onChange={set("traveler_choice")} disabled={!form.client_id}>
            <option value="">{form.client_id ? "Select a traveler…" : "Pick a company first"}</option>
            {clientTravelers.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            <option value="__new__">+ Add new traveler…</option>
          </select>
          {travelerTripCount !== null && (
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              {travelerTripCount} trip{travelerTripCount === 1 ? "" : "s"} this year
            </div>
          )}
        </div>
        {form.traveler_choice === "__new__" && (
          <div>
            <label>New traveler name</label>
            <input required value={form.new_traveler_name} onChange={set("new_traveler_name")} placeholder="Full name" />
          </div>
        )}
        <div><label>From</label><input value={form.from_code} onChange={set("from_code")} placeholder="PHX" /></div>
        <div><label>To</label><input value={form.to_code} onChange={set("to_code")} placeholder="DFW" /></div>
        <div>
          <label>Airline</label>
          <select
            required
            value={form.airline_choice}
            onChange={(e) => {
              const val = e.target.value;
              setForm({ ...form, airline_choice: val, airline_code: AIRLINE_CODES[val] || "" });
            }}
          >
            <option value="">Select…</option>
            {AIRLINES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {form.airline_choice === "Other" && (
          <div><label>Airline name</label><input required value={form.airline_other} onChange={set("airline_other")} placeholder="Airline name" /></div>
        )}
        <div>
          <label>Airline code</label>
          <input
            required
            value={form.airline_code}
            onChange={(e) => setForm({ ...form, airline_code: e.target.value.toUpperCase() })}
            placeholder="AA"
            style={{ textTransform: "uppercase" }}
          />
        </div>
        <div>
          <label>Flight number</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input required value={form.flight_number} onChange={set("flight_number")} placeholder="887" style={{ flex: 1 }} />
            <button
              type="button"
              className="ghost"
              onClick={() => googleFlightSearch(`${form.airline_code} ${form.flight_number}`.trim())}
              title="Look up on Google"
            >🔎</button>
          </div>
        </div>
        <div>
          <label>Departs</label>
          <select required value={form.departure_time} onChange={set("departure_time")}>
            {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div><label>Duration (hrs)</label><input required type="number" step="0.1" min="0.2" value={form.duration_hours} onChange={set("duration_hours")} /></div>
        <div>
          <label>Booking status</label>
          <select value={form.booking_status} onChange={set("booking_status")}>
            <option value="pending">Pending</option>
            <option value="working">Agent Working On It</option>
            <option value="booked">Booked &amp; Confirmed</option>
          </select>
        </div>
        {form.booking_status === "booked" && (
          <div>
            <label>Ticket price ($)</label>
            <input required type="number" step="0.01" min="0" value={form.ticket_price} onChange={set("ticket_price")} placeholder="482.50" />
          </div>
        )}

        <div className="form-full" style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--line)", marginTop: 6, paddingTop: 10 }}>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div>
              <label>Hotel?</label>
              <select value={form.has_hotel} onChange={set("has_hotel")}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
            {form.has_hotel === "yes" && (
              <>
                <div><label>Hotel brand</label>
                  <select value={form.hotel_brand} onChange={set("hotel_brand")}>
                    <option value="">Select…</option>
                    {HOTEL_BRANDS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div><label>Hotel price ($)</label><input type="number" step="0.01" min="0" value={form.hotel_price} onChange={set("hotel_price")} placeholder="189.00" /></div>
                <div><label>Confirmation #</label><input value={form.hotel_confirmation} onChange={set("hotel_confirmation")} /></div>
                <div><label>Check-in</label><input type="date" value={form.hotel_checkin} onChange={set("hotel_checkin")} /></div>
                <div><label>Check-out</label><input type="date" value={form.hotel_checkout} onChange={set("hotel_checkout")} /></div>
                <div><label>Hotel loyalty #</label><input disabled value={selectedTraveler?.hotel_loyalty_number || ""} placeholder="—" /></div>
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 14 }}>
            <div>
              <label>Rental car?</label>
              <select value={form.has_car} onChange={set("has_car")}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
            {form.has_car === "yes" && (
              <>
                <div><label>Car company</label>
                  <select value={form.car_company} onChange={set("car_company")}>
                    <option value="">Select…</option>
                    {CAR_COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label>Car price ($)</label><input type="number" step="0.01" min="0" value={form.car_price} onChange={set("car_price")} placeholder="145.00" /></div>
                <div><label>Confirmation #</label><input value={form.car_confirmation} onChange={set("car_confirmation")} /></div>
                <div><label>Pickup date</label><input type="date" value={form.car_pickup_date} onChange={set("car_pickup_date")} /></div>
                <div><label>Dropoff date</label><input type="date" value={form.car_dropoff_date} onChange={set("car_dropoff_date")} /></div>
                <div><label>Car loyalty #</label><input disabled value={selectedTraveler?.car_loyalty_number || ""} placeholder="—" /></div>
              </>
            )}
          </div>
        </div>

        <div><button type="submit">Add trip</button></div>
      </form>
    </div>
  );
}

function FutureTrips({ trips, today }) {
  const month = today.slice(0, 7);
  const future = trips
    .filter((t) => t.travel_date > today && t.travel_date.slice(0, 7) === month)
    .sort((a, b) => (a.travel_date < b.travel_date ? -1 : 1));

  return (
    <>
      <div className="sec-head">
        <h2>Future Trips — This Month</h2>
        <span className="count">{future.length} {future.length === 1 ? "upcoming" : "upcoming"}</span>
      </div>
      <div className="tbl-wrap">
        <table className="k">
          <thead>
            <tr>
              <th>Date</th><th>Client #</th><th>Client</th><th>Plan</th><th>Traveler</th>
              <th>Routing</th><th>Flight</th><th>Contact</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {future.length === 0 ? (
              <tr><td colSpan={9} className="empty">No further trips scheduled this month.</td></tr>
            ) : (
              future.map((t) => {
                const bm = BOOKING_META[t.booking_status] || BOOKING_META.pending;
                return (
                  <tr key={t.id}>
                    <td><b>{prettyDate(t.travel_date)}</b></td>
                    <td className="cnum">{t.client_number || "—"}</td>
                    <td>{t.company_name || "—"}</td>
                    <td>{t.plan_tier ? <span className="plan-tag">{t.plan_tier}</span> : "—"}</td>
                    <td>{t.client_name}</td>
                    <td>{t.from_code || "?"} → {t.to_code || "?"}</td>
                    <td className="muted">{t.airline} {t.flight_number} · {fmtHour(timeToDecimal(t.departure_time))}</td>
                    <td className="muted">{t.contact_phone || "—"}</td>
                    <td><span className={`status ${bm.className}`}>{bm.label}</span></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Tracker({ session }) {
  const [date, setDate] = useState(localDateStr());
  const [trips, setTrips] = useState([]);
  const [allTrips, setAllTrips] = useState([]);
  const [clients, setClients] = useState([]);
  const [travelers, setTravelers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTrip, setEditingTrip] = useState(null);
  const [expandedDetails, setExpandedDetails] = useState({});
  const [editTripForm, setEditTripForm] = useState(null);

  async function loadClients() {
    const { data, error } = await supabase.from("clients").select("*").eq("status", "active").order("company_name");
    if (!error) setClients(data);
  }

  async function loadTravelers() {
    const { data, error } = await supabase.from("travelers").select("*");
    if (!error) setTravelers(data);
  }

  async function loadTrips() {
    setLoading(true);
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .eq("travel_date", date)
      .order("departure_time", { ascending: true });
    if (!error) setTrips(data);
    setLoading(false);
  }

  async function loadAllTrips() {
    const { data, error } = await supabase.from("trips").select("*");
    if (!error) setAllTrips(data);
  }

  useEffect(() => {
    loadTrips();
    loadAllTrips();
    loadClients();
    loadTravelers();

    const channel = supabase
      .channel("trips-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => {
        loadTrips();
        loadAllTrips();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function addTrip(form, tripDate) {
    const client = clients.find((c) => c.id === form.client_id);
    let travelerName = form.traveler_choice;

    if (travelerName === "__new__") {
      travelerName = form.new_traveler_name.trim();
      if (travelerName) {
        await supabase.from("travelers").insert({ client_id: form.client_id, name: travelerName });
        loadTravelers();
      }
    }

    const airline = form.airline_choice === "Other" ? form.airline_other : form.airline_choice;
    const fullFlightNumber = `${form.airline_code}${form.flight_number}`.trim();

    const { data: newTrip } = await supabase.from("trips").insert({
      client_id: form.client_id || null,
      company_name: client?.company_name || null,
      client_number: client?.client_number || null,
      plan_tier: client?.plan_tier || null,
      contact_phone: client?.contact_phone || null,
      client_name: travelerName,
      from_code: form.from_code || null,
      to_code: form.to_code || null,
      airline,
      flight_number: fullFlightNumber,
      travel_date: tripDate,
      departure_time: form.departure_time,
      duration_hours: parseFloat(form.duration_hours) || 2,
      status: "ontime",
      booking_status: form.booking_status,
      ticket_price: form.booking_status === "booked" ? (parseFloat(form.ticket_price) || 0) : null,
      has_hotel: form.has_hotel === "yes",
      hotel_brand: form.has_hotel === "yes" ? form.hotel_brand : null,
      hotel_price: form.has_hotel === "yes" ? (parseFloat(form.hotel_price) || 0) : null,
      hotel_confirmation: form.has_hotel === "yes" ? form.hotel_confirmation : null,
      hotel_checkin: form.has_hotel === "yes" ? (form.hotel_checkin || null) : null,
      hotel_checkout: form.has_hotel === "yes" ? (form.hotel_checkout || null) : null,
      has_car: form.has_car === "yes",
      car_company: form.has_car === "yes" ? form.car_company : null,
      car_price: form.has_car === "yes" ? (parseFloat(form.car_price) || 0) : null,
      car_confirmation: form.has_car === "yes" ? form.car_confirmation : null,
      car_pickup_date: form.has_car === "yes" ? (form.car_pickup_date || null) : null,
      car_dropoff_date: form.has_car === "yes" ? (form.car_dropoff_date || null) : null,
      entered_by: session.user.email,
    }).select().single();

    if (newTrip && newTrip.booking_status === "booked" && newTrip.client_id) {
      await logBookingFeeToEhlo(newTrip, session);
      await supabase.from("trips").update({ fee_logged_to_ehlo: true }).eq("id", newTrip.id);
    }

    loadTrips();
    loadAllTrips();
  }

  async function removeTrip(trip) {
    if (trip.fee_logged_to_ehlo) {
      const { data: linkedExpenses } = await supabase
        .from("client_expenses")
        .select("*")
        .eq("source_trip_id", trip.id);

      const needsReview = [];
      for (const linkedExpense of linkedExpenses || []) {
        if (Number(linkedExpense.amount) === 0) {
          // Nothing of value entered yet on the Ehlo side — safe to remove the auto-generated placeholder too
          await supabase.from("client_expenses").delete().eq("id", linkedExpense.id);
        } else {
          // Someone already entered a real cost — never silently delete real billing data
          needsReview.push(`${linkedExpense.category} ($${linkedExpense.amount})`);
        }
      }

      if (needsReview.length > 0) {
        await supabase.from("client_notes").insert({
          client_id: trip.client_id,
          note: `Heads up: the Knox trip this billing came from (${trip.client_name}, ${trip.airline} ${trip.flight_number}, ${trip.travel_date}) was deleted. Please verify these entries are still correct: ${needsReview.join(", ")}.`,
          created_by: session.user.email,
        });
      }
    }

    await supabase.from("trips").delete().eq("id", trip.id);
    loadTrips();
    loadAllTrips();
  }

  async function flagDisruption(t) {
    const note = prompt(`What happened with ${t.client_name}'s trip (${t.airline} ${t.flight_number})? This gets logged for billing review.`);
    if (note === null || !note.trim()) return;
    await supabase.from("trips").update({ had_disruption: true }).eq("id", t.id);
    if (t.client_id) {
      await supabase.from("client_notes").insert({
        client_id: t.client_id,
        note: `Disruption on ${t.client_name}'s trip (${t.airline} ${t.flight_number}, ${t.travel_date}): ${note.trim()} — check for extra costs to bill.`,
        created_by: session.user.email,
      });
    }
    loadTrips();
  }

  function openEditTrip(t) {
    setEditingTrip(t);
    setEditTripForm({
      client_name: t.client_name || "",
      airline: t.airline || "",
      flight_number: t.flight_number || "",
      from_code: t.from_code || "",
      to_code: t.to_code || "",
      departure_time: t.departure_time?.slice(0, 5) || "09:00",
      duration_hours: t.duration_hours || 2.5,
      booking_status: t.booking_status || "pending",
      ticket_price: t.ticket_price ?? "",
      has_hotel: t.has_hotel ? "yes" : "no",
      hotel_brand: t.hotel_brand || "",
      hotel_price: t.hotel_price ?? "",
      hotel_confirmation: t.hotel_confirmation || "",
      hotel_checkin: t.hotel_checkin || "",
      hotel_checkout: t.hotel_checkout || "",
      has_car: t.has_car ? "yes" : "no",
      car_company: t.car_company || "",
      car_price: t.car_price ?? "",
      car_confirmation: t.car_confirmation || "",
      car_pickup_date: t.car_pickup_date || "",
      car_dropoff_date: t.car_dropoff_date || "",
    });
  }

  async function saveEditTrip() {
    const newTicketPrice = editTripForm.booking_status === "booked" ? (parseFloat(editTripForm.ticket_price) || 0) : editingTrip.ticket_price;

    const hotelCarPayload = {
      has_hotel: editTripForm.has_hotel === "yes",
      hotel_brand: editTripForm.has_hotel === "yes" ? editTripForm.hotel_brand : null,
      hotel_price: editTripForm.has_hotel === "yes" ? (parseFloat(editTripForm.hotel_price) || 0) : null,
      hotel_confirmation: editTripForm.has_hotel === "yes" ? editTripForm.hotel_confirmation : null,
      hotel_checkin: editTripForm.has_hotel === "yes" ? (editTripForm.hotel_checkin || null) : null,
      hotel_checkout: editTripForm.has_hotel === "yes" ? (editTripForm.hotel_checkout || null) : null,
      has_car: editTripForm.has_car === "yes",
      car_company: editTripForm.has_car === "yes" ? editTripForm.car_company : null,
      car_price: editTripForm.has_car === "yes" ? (parseFloat(editTripForm.car_price) || 0) : null,
      car_confirmation: editTripForm.has_car === "yes" ? editTripForm.car_confirmation : null,
      car_pickup_date: editTripForm.has_car === "yes" ? (editTripForm.car_pickup_date || null) : null,
      car_dropoff_date: editTripForm.has_car === "yes" ? (editTripForm.car_dropoff_date || null) : null,
    };

    await supabase.from("trips").update({
      client_name: editTripForm.client_name,
      airline: editTripForm.airline,
      flight_number: editTripForm.flight_number,
      from_code: editTripForm.from_code || null,
      to_code: editTripForm.to_code || null,
      departure_time: editTripForm.departure_time,
      duration_hours: parseFloat(editTripForm.duration_hours) || 2,
      booking_status: editTripForm.booking_status,
      ticket_price: newTicketPrice,
      ...hotelCarPayload,
    }).eq("id", editingTrip.id);

    const justBooked = editingTrip.booking_status !== "booked" && editTripForm.booking_status === "booked";
    if (justBooked && editingTrip.client_id && !editingTrip.fee_logged_to_ehlo) {
      await logBookingFeeToEhlo({ ...editingTrip, ...editTripForm, ticket_price: newTicketPrice, ...hotelCarPayload }, session);
      await supabase.from("trips").update({ fee_logged_to_ehlo: true }).eq("id", editingTrip.id);
    } else if (editingTrip.fee_logged_to_ehlo && Number(newTicketPrice) !== Number(editingTrip.ticket_price)) {
      // Price was corrected after the fee was already logged — keep the Ehlo Flight entry in sync (not the Hotel/Car ones)
      await supabase.from("client_expenses").update({ amount: Number(newTicketPrice) || 0 }).eq("source_trip_id", editingTrip.id).eq("category", "Flight");
    }

    setEditingTrip(null);
    loadTrips();
    loadAllTrips();
  }

  async function setStatus(id, status) {
    await supabase.from("trips").update({
      status,
      manual_override: true,
      status_changed_by: session.user.email,
      status_changed_at: new Date().toISOString(),
    }).eq("id", id);
    loadTrips();
  }

  async function resumeAuto(id) {
    await supabase.from("trips").update({ manual_override: false }).eq("id", id);
    loadTrips();
  }

  async function updateTripDate(id, newDate) {
    await supabase.from("trips").update({ travel_date: newDate }).eq("id", id);
    loadTrips();
    loadAllTrips();
  }

  const counts = { ontime: 0, delayed: 0, cancelled: 0 };
  trips.forEach((t) => counts[t.status]++);
  const today = localDateStr();

  return (
    <div>
      <div className="welcome">
        <div>
          <h1>Welcome to Knox</h1>
          <p>Everything on today's board, plus what's coming this month.</p>
        </div>
        <div className="today">
          <div className="d">{prettyDate(today)}</div>
          <div className="l">Today</div>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="n">{trips.length}</div><div className="l">Traveling</div></div>
        <div className="stat"><div className="n" style={{ color: STATUS_META.ontime.color }}>{counts.ontime}</div><div className="l">On time</div></div>
        <div className="stat"><div className="n" style={{ color: STATUS_META.delayed.color }}>{counts.delayed}</div><div className="l">Delayed</div></div>
        <div className="stat"><div className="n" style={{ color: STATUS_META.cancelled.color }}>{counts.cancelled}</div><div className="l">Cancelled</div></div>
      </div>

      <TripForm date={date} onAdd={addTrip} clients={clients} travelers={travelers} />

      <div className="panel">
        <div className="sec-head" style={{ margin: 0 }}>
          <h2>Board — {date}</h2>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="date-input" />
        </div>
        <div className="legend">
          {Object.entries(STATUS_META).map(([k, v]) => (
            <span key={k}><span className="dot" style={{ background: v.color }} />{v.label}</span>
          ))}
        </div>

        {loading ? (
          <div className="empty">Loading…</div>
        ) : trips.length === 0 ? (
          <div className="empty">No trips added for this date yet.</div>
        ) : (
          trips.map((t) => {
            const dep = timeToDecimal(t.departure_time);
            const left = Math.min(Math.max(((dep - DAY_START) / (DAY_END - DAY_START)) * 100, 0), 100);
            const width = Math.min(Math.max((t.duration_hours / (DAY_END - DAY_START)) * 100, 2.5), 100 - left);
            const meta = STATUS_META[t.status];
            return (
              <div className="trip-block" key={t.id}>
              <div className="row">
                <div>
                  <div className="client">{t.client_name}{t.company_name ? ` · ${t.company_name}` : ""}</div>
                  <div className="flightinfo">
                    {t.airline} · {t.flight_number} · dep {fmtHour(dep)}
                    {t.origin_code && t.destination_code ? ` · ${t.origin_code} → ${t.destination_code}` : ""}
                    {" "}
                    <button
                      type="button"
                      className="ghost"
                      style={{ padding: "0px 6px", fontSize: 10.5, marginLeft: 4 }}
                      onClick={() => googleFlightSearch(spacedFlightNumber(t.flight_number))}
                      title="Look up on Google"
                    >🔎 Look up</button>
                  </div>
                  <div className="date-edit">
                    Date: <input type="date" value={t.travel_date} onChange={(e) => updateTripDate(t.id, e.target.value)} />
                  </div>
                  {t.phase && (
                    <div className="phase-line">
                      {t.phase}
                      {t.eta ? ` · ETA ${new Date(t.eta).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
                      {t.gate_destination ? ` · Gate ${t.gate_destination}` : ""}
                      {t.terminal_destination ? ` · Terminal ${t.terminal_destination}` : ""}
                    </div>
                  )}
                  {t.verification_issue && <div className="verify-warning">{t.verification_issue}</div>}
                  {t.origin_code && t.destination_code && (
                    <div className="route-track">
                      <span className="route-code">{t.origin_code}</span>
                      <div className="route-line">
                        <div className="route-fill" style={{ width: `${t.progress_percent || 0}%` }} />
                        <span className="route-plane" style={{ left: `${t.progress_percent || 0}%` }}>✈</span>
                      </div>
                      <span className="route-code">{t.destination_code}</span>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                    <span
                      style={{ fontSize: 11.5, fontWeight: 600, cursor: t.ticket_price ? "pointer" : "default", color: t.ticket_price ? "var(--green)" : "var(--red)" }}
                      onClick={() => t.ticket_price && setExpandedDetails({ ...expandedDetails, [t.id + "-flight"]: !expandedDetails[t.id + "-flight"] })}
                    >
                      {t.ticket_price ? "✓" : "✗"} Flight
                    </span>
                    <span
                      style={{ fontSize: 11.5, fontWeight: 600, cursor: t.has_hotel ? "pointer" : "default", color: t.has_hotel ? "var(--green)" : "var(--red)" }}
                      onClick={() => t.has_hotel && setExpandedDetails({ ...expandedDetails, [t.id + "-hotel"]: !expandedDetails[t.id + "-hotel"] })}
                    >
                      {t.has_hotel ? "✓" : "✗"} Hotel
                    </span>
                    <span
                      style={{ fontSize: 11.5, fontWeight: 600, cursor: t.has_car ? "pointer" : "default", color: t.has_car ? "var(--green)" : "var(--red)" }}
                      onClick={() => t.has_car && setExpandedDetails({ ...expandedDetails, [t.id + "-car"]: !expandedDetails[t.id + "-car"] })}
                    >
                      {t.has_car ? "✓" : "✗"} Car
                    </span>
                  </div>

                  {expandedDetails[t.id + "-flight"] && t.ticket_price && (
                    <div className="phase-line" style={{ marginTop: 4 }}>
                      ✈ Ticket price: ${Number(t.ticket_price).toFixed(2)} · Booking fee: ${KNOX_FLIGHT_FEE_RATES[t.plan_tier] ?? 32}
                    </div>
                  )}
                  {expandedDetails[t.id + "-hotel"] && t.has_hotel && (
                    <div className="phase-line" style={{ marginTop: 4 }}>
                      🏨 {t.hotel_brand} · ${Number(t.hotel_price || 0).toFixed(2)} · Conf# {t.hotel_confirmation || "—"} · {t.hotel_checkin} → {t.hotel_checkout} · Booking fee: ${KNOX_OTHER_FEE_RATES[t.plan_tier] ?? 32}
                    </div>
                  )}
                  {expandedDetails[t.id + "-car"] && t.has_car && (
                    <div className="phase-line" style={{ marginTop: 4 }}>
                      🚗 {t.car_company} · ${Number(t.car_price || 0).toFixed(2)} · Conf# {t.car_confirmation || "—"} · {t.car_pickup_date} → {t.car_dropoff_date} · Booking fee: ${KNOX_OTHER_FEE_RATES[t.plan_tier] ?? 32}
                    </div>
                  )}
                  {(expandedDetails[t.id + "-flight"] || expandedDetails[t.id + "-hotel"] || expandedDetails[t.id + "-car"]) && (() => {
                    const flightCost = Number(t.ticket_price) || 0;
                    const hotelCost = t.has_hotel ? (Number(t.hotel_price) || 0) : 0;
                    const carCost = t.has_car ? (Number(t.car_price) || 0) : 0;
                    const flightFee = flightCost > 0 ? (KNOX_FLIGHT_FEE_RATES[t.plan_tier] ?? 32) : 0;
                    const hotelFee = t.has_hotel ? (KNOX_OTHER_FEE_RATES[t.plan_tier] ?? 32) : 0;
                    const carFee = t.has_car ? (KNOX_OTHER_FEE_RATES[t.plan_tier] ?? 32) : 0;
                    const totalCost = flightCost + hotelCost + carCost;
                    const totalFees = flightFee + hotelFee + carFee;
                    return (
                      <div className="phase-line" style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--line)" }}>
                        💰 Trip total — travel cost: ${totalCost.toFixed(2)} + OneStone fees: ${totalFees.toFixed(2)} = <b>${(totalCost + totalFees).toFixed(2)}</b>
                      </div>
                    );
                  })()}
                </div>
                <div className="track">
                  <div className="bar" style={{ left: `${left}%`, width: `${width}%`, background: meta.color }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <select className="status-select" value={t.status} onChange={(e) => setStatus(t.id, e.target.value)} style={{ background: meta.bg, color: meta.color }}>
                    {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  {t.manual_override && (
                    <div className="manual-tag">
                      set by {t.status_changed_by}{t.status_changed_at ? ` · ${new Date(t.status_changed_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
                      <br /><button className="ghost" style={{ marginTop: 3 }} onClick={() => resumeAuto(t.id)}>Resume auto-updates</button>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <button className="ghost" onClick={() => openEditTrip(t)}>Edit</button>
                  <button className="ghost" style={{ marginLeft: 6 }} onClick={() => removeTrip(t)}>Remove</button>
                  <br />
                  <button className="ghost" style={{ marginTop: 6, color: t.had_disruption ? "var(--red)" : undefined, borderColor: t.had_disruption ? "var(--red)" : undefined }} onClick={() => flagDisruption(t)}>
                    {t.had_disruption ? "⚠ Disruption logged" : "Flag disruption"}
                  </button>
                </div>
              </div>
              <TripNotes tripId={t.id} session={session} />
              </div>
            );
          })
        )}

        <div className="axis">
          {Array.from({ length: Math.floor((DAY_END - DAY_START) / 3) + 1 }, (_, i) => DAY_START + i * 3).map((h) => (
            <span key={h}>{fmtHour(h)}</span>
          ))}
        </div>
      </div>

      <FutureTrips trips={allTrips} today={today} />

      {editingTrip && (
        <div className="modal-overlay" onClick={(ev) => { if (ev.target === ev.currentTarget) setEditingTrip(null); }}>
          <div className="modal-box">
            <h3>Edit trip</h3>
            <div className="modal-sub">{editingTrip.travel_date}</div>

            <label>Traveler</label>
            <input value={editTripForm.client_name} onChange={(e) => setEditTripForm({ ...editTripForm, client_name: e.target.value })} />

            <label>Airline</label>
            <input value={editTripForm.airline} onChange={(e) => setEditTripForm({ ...editTripForm, airline: e.target.value })} />

            <label>Flight #</label>
            <input value={editTripForm.flight_number} onChange={(e) => setEditTripForm({ ...editTripForm, flight_number: e.target.value.toUpperCase() })} />

            <label>From</label>
            <input value={editTripForm.from_code} onChange={(e) => setEditTripForm({ ...editTripForm, from_code: e.target.value.toUpperCase() })} />

            <label>To</label>
            <input value={editTripForm.to_code} onChange={(e) => setEditTripForm({ ...editTripForm, to_code: e.target.value.toUpperCase() })} />

            <label>Departs</label>
            <select value={editTripForm.departure_time} onChange={(e) => setEditTripForm({ ...editTripForm, departure_time: e.target.value })}>
              {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            <label>Duration (hrs)</label>
            <input type="number" step="0.1" min="0.2" value={editTripForm.duration_hours} onChange={(e) => setEditTripForm({ ...editTripForm, duration_hours: e.target.value })} />

            <label>Booking status</label>
            <select value={editTripForm.booking_status} onChange={(e) => setEditTripForm({ ...editTripForm, booking_status: e.target.value })}>
              <option value="pending">Pending</option>
              <option value="working">Agent Working On It</option>
              <option value="booked">Booked &amp; Confirmed</option>
            </select>

            {editTripForm.booking_status === "booked" && (
              <>
                <label>Ticket price ($)</label>
                <input type="number" step="0.01" min="0" value={editTripForm.ticket_price} onChange={(e) => setEditTripForm({ ...editTripForm, ticket_price: e.target.value })} placeholder="482.50" />
              </>
            )}

            <label>Hotel?</label>
            <select value={editTripForm.has_hotel} onChange={(e) => setEditTripForm({ ...editTripForm, has_hotel: e.target.value })}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
            {editTripForm.has_hotel === "yes" && (
              <>
                <label>Hotel brand</label>
                <select value={editTripForm.hotel_brand} onChange={(e) => setEditTripForm({ ...editTripForm, hotel_brand: e.target.value })}>
                  <option value="">Select…</option>
                  {HOTEL_BRANDS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <label>Hotel price ($)</label>
                <input type="number" step="0.01" min="0" value={editTripForm.hotel_price} onChange={(e) => setEditTripForm({ ...editTripForm, hotel_price: e.target.value })} />
                <label>Confirmation #</label>
                <input value={editTripForm.hotel_confirmation} onChange={(e) => setEditTripForm({ ...editTripForm, hotel_confirmation: e.target.value })} />
                <label>Check-in</label>
                <input type="date" value={editTripForm.hotel_checkin} onChange={(e) => setEditTripForm({ ...editTripForm, hotel_checkin: e.target.value })} />
                <label>Check-out</label>
                <input type="date" value={editTripForm.hotel_checkout} onChange={(e) => setEditTripForm({ ...editTripForm, hotel_checkout: e.target.value })} />
              </>
            )}

            <label>Rental car?</label>
            <select value={editTripForm.has_car} onChange={(e) => setEditTripForm({ ...editTripForm, has_car: e.target.value })}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
            {editTripForm.has_car === "yes" && (
              <>
                <label>Car company</label>
                <select value={editTripForm.car_company} onChange={(e) => setEditTripForm({ ...editTripForm, car_company: e.target.value })}>
                  <option value="">Select…</option>
                  {CAR_COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <label>Car price ($)</label>
                <input type="number" step="0.01" min="0" value={editTripForm.car_price} onChange={(e) => setEditTripForm({ ...editTripForm, car_price: e.target.value })} />
                <label>Confirmation #</label>
                <input value={editTripForm.car_confirmation} onChange={(e) => setEditTripForm({ ...editTripForm, car_confirmation: e.target.value })} />
                <label>Pickup date</label>
                <input type="date" value={editTripForm.car_pickup_date} onChange={(e) => setEditTripForm({ ...editTripForm, car_pickup_date: e.target.value })} />
                <label>Dropoff date</label>
                <input type="date" value={editTripForm.car_dropoff_date} onChange={(e) => setEditTripForm({ ...editTripForm, car_dropoff_date: e.target.value })} />
              </>
            )}

            <div className="modal-actions">
              <button className="ghost" onClick={() => setEditingTrip(null)}>Cancel</button>
              <button onClick={saveEditTrip}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KnoxShell({ session }) {
  const [tab, setTab] = useState("tracker");
  const [requestCount, setRequestCount] = useState(0);

  async function loadRequestCount() {
    const { count } = await supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "New");
    setRequestCount(count || 0);
  }

  useEffect(() => { loadRequestCount(); }, [tab]);

  return (
    <div>
      <div className="knoxbar">
        <div className="knoxbar-inner">
          <div>
            <div className="knox-logo">KN<span>O</span>X <span className="version-tag">v2.2</span></div>
            <div className="knox-sub">OneStone Staff System</div>
          </div>
          <div className="knox-user">
            <span>Signed in as <span className="who">{session.user.email}</span></span>
            <button onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        </div>
        <div className="knox-tabs">
          <button className={`knox-tab ${tab === "tracker" ? "active" : ""}`} onClick={() => setTab("tracker")}>
            Daily Client Tracker
          </button>
          <button className={`knox-tab ${tab === "requests" ? "active" : ""}`} onClick={() => setTab("requests")}>
            Travel Requests
            {requestCount > 0 && <span className="tab-badge">{requestCount}</span>}
          </button>
          <button className={`knox-tab ${tab === "disruption" ? "active" : ""}`} onClick={() => setTab("disruption")}>
            Disruption Tool
          </button>
        </div>
      </div>

      <div className="wrap">
        {tab === "tracker" && <Tracker session={session} />}
        {tab === "requests" && <Requests session={session} />}
        {tab === "disruption" && <DisruptionTool />}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!checked) return null;
  return session ? <KnoxShell session={session} /> : <Login />;
}
