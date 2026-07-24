import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import DisruptionTool from "./DisruptionTool";

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
    company_name: "",
    client_number: "",
    plan_tier: "",
    client_name: "",
    from_code: "",
    to_code: "",
    airline: "",
    flight_number: "",
    departure_time: "09:00",
    duration_hours: 2.5,
    contact_phone: "",
    booking_status: "pending",
  };
}

function TripForm({ date, onAdd }) {
  const [form, setForm] = useState(emptyForm());

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
        <div><label>Company</label><input value={form.company_name} onChange={set("company_name")} placeholder="Valley Health Staffing" /></div>
        <div><label>Client #</label><input value={form.client_number} onChange={set("client_number")} placeholder="OS-1001-C" /></div>
        <div><label>Plan</label><input value={form.plan_tier} onChange={set("plan_tier")} placeholder="Anchor" /></div>
        <div><label>Traveler</label><input required value={form.client_name} onChange={set("client_name")} placeholder="Dana Reyes" /></div>
        <div><label>From</label><input value={form.from_code} onChange={set("from_code")} placeholder="PHX" /></div>
        <div><label>To</label><input value={form.to_code} onChange={set("to_code")} placeholder="DFW" /></div>
        <div><label>Airline</label><input required value={form.airline} onChange={set("airline")} placeholder="American" /></div>
        <div><label>Flight #</label><input required value={form.flight_number} onChange={set("flight_number")} placeholder="AA887" /></div>
        <div><label>Departs</label><input required type="time" value={form.departure_time} onChange={set("departure_time")} /></div>
        <div><label>Duration (hrs)</label><input required type="number" step="0.1" min="0.2" value={form.duration_hours} onChange={set("duration_hours")} /></div>
        <div><label>Contact phone</label><input value={form.contact_phone} onChange={set("contact_phone")} placeholder="(602) 555-0142" /></div>
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
  const [loading, setLoading] = useState(true);

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
    await supabase.from("trips").insert({
      company_name: form.company_name || null,
      client_number: form.client_number || null,
      plan_tier: form.plan_tier || null,
      client_name: form.client_name,
      from_code: form.from_code || null,
      to_code: form.to_code || null,
      airline: form.airline,
      flight_number: form.flight_number,
      travel_date: tripDate,
      departure_time: form.departure_time,
      duration_hours: parseFloat(form.duration_hours) || 2,
      status: "ontime",
      booking_status: form.booking_status,
      contact_phone: form.contact_phone || null,
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

      <TripForm date={date} onAdd={addTrip} />

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
              <div className="row" key={t.id}>
                <div>
                  <div className="client">{t.client_name}{t.company_name ? ` · ${t.company_name}` : ""}</div>
                  <div className="flightinfo">
                    {t.airline} · {t.flight_number} · dep {fmtHour(dep)}
                    {t.origin_code && t.destination_code ? ` · ${t.origin_code} → ${t.destination_code}` : ""}
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
                  <button className="ghost" onClick={() => removeTrip(t.id)}>Remove</button>
                </div>
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
            <div className="knox-logo">KN<span>O</span>X</div>
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
