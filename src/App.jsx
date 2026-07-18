import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const DAY_START = 5;
const DAY_END = 23;

const STATUS_META = {
  ontime: { label: "On time", color: "#2F6E4E", bg: "#E3EFE7" },
  delayed: { label: "Delayed", color: "#9C6A15", bg: "#F6ECD8" },
  cancelled: { label: "Cancelled", color: "#A23B32", bg: "#F6E2DE" },
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

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
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
        <h1>OneStone Travel</h1>
        <p className="sub">Staff sign in</p>
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

function Dashboard({ session }) {
  const [date, setDate] = useState(todayISO());
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    client_name: "",
    airline: "",
    flight_number: "",
    departure_time: "09:00",
    duration_hours: 2.5,
  });

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

  useEffect(() => {
    loadTrips();

    // Live updates: if someone else adds/changes a trip, everyone sees it without refreshing
    const channel = supabase
      .channel("trips-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => loadTrips())
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function addTrip(e) {
    e.preventDefault();
    await supabase.from("trips").insert({
      client_name: form.client_name,
      airline: form.airline,
      flight_number: form.flight_number,
      travel_date: date,
      departure_time: form.departure_time,
      duration_hours: parseFloat(form.duration_hours) || 2,
      status: "ontime",
      entered_by: session.user.email,
    });
    setForm({ client_name: "", airline: "", flight_number: "", departure_time: "09:00", duration_hours: 2.5 });
    loadTrips();
  }

  async function removeTrip(id) {
    await supabase.from("trips").delete().eq("id", id);
    loadTrips();
  }

  async function setStatus(id, status) {
    await supabase.from("trips").update({ status, manual_override: true }).eq("id", id);
    loadTrips();
  }

  const counts = { ontime: 0, delayed: 0, cancelled: 0 };
  trips.forEach((t) => counts[t.status]++);

  return (
    <div className="wrap">
      <header>
        <div>
          <h1>OneStone Travel</h1>
          <div className="sub">Daily client tracker</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="date-input" />
          <div className="sub" style={{ marginTop: 4 }}>{session.user.email}</div>
          <button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      <div className="stats">
        <div className="stat"><div className="n">{trips.length}</div><div className="l">Traveling</div></div>
        <div className="stat"><div className="n" style={{ color: STATUS_META.ontime.color }}>{counts.ontime}</div><div className="l">On time</div></div>
        <div className="stat"><div className="n" style={{ color: STATUS_META.delayed.color }}>{counts.delayed}</div><div className="l">Delayed</div></div>
        <div className="stat"><div className="n" style={{ color: STATUS_META.cancelled.color }}>{counts.cancelled}</div><div className="l">Cancelled</div></div>
      </div>

      <div className="panel">
        <h2>Add a client trip</h2>
        <form className="trip-form" onSubmit={addTrip}>
          <div><label>Client name</label>
            <input required value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="Priya Nair" />
          </div>
          <div><label>Airline</label>
            <input required value={form.airline} onChange={(e) => setForm({ ...form, airline: e.target.value })} placeholder="American" />
          </div>
          <div><label>Flight #</label>
            <input required value={form.flight_number} onChange={(e) => setForm({ ...form, flight_number: e.target.value })} placeholder="AA887" />
          </div>
          <div><label>Departs</label>
            <input required type="time" value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} />
          </div>
          <div><label>Duration (hrs)</label>
            <input required type="number" step="0.1" min="0.2" value={form.duration_hours} onChange={(e) => setForm({ ...form, duration_hours: e.target.value })} />
          </div>
          <div><button type="submit">Add trip</button></div>
        </form>
      </div>

      <div className="panel">
        <h2>Board — {date}</h2>
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
            const left = ((dep - DAY_START) / (DAY_END - DAY_START)) * 100;
            const width = Math.max((t.duration_hours / (DAY_END - DAY_START)) * 100, 2.5);
            const meta = STATUS_META[t.status];
            return (
              <div className="row" key={t.id}>
                <div>
                  <div className="client">{t.client_name}</div>
                  <div className="flightinfo">{t.airline} · {t.flight_number} · dep {fmtHour(dep)}</div>
                </div>
                <div className="track">
                  <div className="bar" style={{ left: `${left}%`, width: `${width}%`, background: meta.color }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <select
                    className="status-select"
                    value={t.status}
                    onChange={(e) => setStatus(t.id, e.target.value)}
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    {Object.entries(STATUS_META).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  {t.manual_override && <div className="manual-tag">manually set</div>}
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
  return session ? <Dashboard session={session} /> : <Login />;
}
