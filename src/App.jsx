import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import DisruptionTool from "./DisruptionTool";
import TripNotes from "./TripNotes";

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

function formatSearchDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function googleFlightSearch({ flightNumber, airline, fromCode, toCode, dateStr }) {
  if (!flightNumber) return;
  const parts = [];
  if (airline) parts.push(airline);
  parts.push(flightNumber);
  parts.push("flight status");
  if (fromCode && toCode) parts.push(`${fromCode} to ${toCode}`);
  if (dateStr) parts.push(formatSearchDate(dateStr));
  window.open(`https://www.google.com/search?q=${encodeURIComponent(parts.join(" "))}`, "_blank");
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
  };
}

function TripForm({ date, onAdd, clients, travelers }) {
  const [form, setForm] = useState(emptyForm());

  const selectedClient = clients.find((c) => c.id === form.client_id);
  const clientTravelers = travelers.filter((t) => t.client_id === form.client_id);

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
          <label>Traveler</label>
          <select required value={form.traveler_choice} onChange={set("traveler_choice")} disabled={!form.client_id}>
            <option value="">{form.client_id ? "Select a traveler…" : "Pick a company first"}</option>
            {clientTravelers.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            <option value="__new__">+ Add new traveler…</option>
          </select>
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
              onClick={() => googleFlightSearch({
                flightNumber: `${form.airline_code}${form.flight_number}`,
                airline: form.airline_choice === "Other" ? form.airline_other : form.airline_choice,
                fromCode: form.from_code,
                toCode: form.to_code,
                dateStr: date,
              })}
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

    await supabase.from("trips").insert({
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
      entered_by: session.user.email,
    });
    loadTrips();
    loadAllTrips();
  }

  async function removeTrip(id) {
    await supabase.from("trips").delete().eq("id", id);
    loadTrips();
    loadAllTrips();
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
    });
  }

  async function saveEditTrip() {
    await supabase.from("trips").update({
      client_name: editTripForm.client_name,
      airline: editTripForm.airline,
      flight_number: editTripForm.flight_number,
      from_code: editTripForm.from_code || null,
      to_code: editTripForm.to_code || null,
      departure_time: editTripForm.departure_time,
      duration_hours: parseFloat(editTripForm.duration_hours) || 2,
      booking_status: editTripForm.booking_status,
    }).eq("id", editingTrip.id);
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
                      onClick={() => googleFlightSearch({
                        flightNumber: t.flight_number,
                        airline: t.airline,
                        fromCode: t.origin_code || t.from_code,
                        toCode: t.destination_code || t.to_code,
                        dateStr: t.travel_date,
                      })}
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
                  <button className="ghost" style={{ marginLeft: 6 }} onClick={() => removeTrip(t.id)}>Remove</button>
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

  return (
    <div>
      <div className="knoxbar">
        <div className="knoxbar-inner">
          <div>
            <div className="knox-logo">KN<span>O</span>X <span className="version-tag">v1.6</span></div>
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
          <button className={`knox-tab ${tab === "disruption" ? "active" : ""}`} onClick={() => setTab("disruption")}>
            Disruption Tool
          </button>
        </div>
      </div>

      <div className="wrap">
        {tab === "tracker" ? <Tracker session={session} /> : <DisruptionTool />}
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
