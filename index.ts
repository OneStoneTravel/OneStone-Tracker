// This runs on Supabase's servers, not in the browser — so your FlightAware
// API key stays private. It's scheduled to run automatically (set up in Step 6).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FLIGHTAWARE_API_KEY = Deno.env.get("FLIGHTAWARE_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Map FlightAware's status text to our three simple states
function mapStatus(faStatus: string, cancelled: boolean): string {
  if (cancelled) return "cancelled";
  const s = (faStatus || "").toLowerCase();
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("delay")) return "delayed";
  return "ontime";
}

Deno.serve(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  // Only check flights for today and tomorrow — no point checking old ones
  const { data: trips, error } = await supabase
    .from("trips")
    .select("*")
    .in("travel_date", [today, tomorrow]);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results = [];

  for (const trip of trips ?? []) {
    try {
      const ident = trip.flight_number.replace(/\s+/g, "");
      const res = await fetch(
        `https://aeroapi.flightaware.com/aeroapi/flights/${ident}?max_pages=1`,
        { headers: { "x-apikey": FLIGHTAWARE_API_KEY } }
      );

      if (!res.ok) {
        results.push({ flight: trip.flight_number, skipped: true, reason: `HTTP ${res.status}` });
        continue;
      }

      const json = await res.json();
      const flight = json.flights?.[0];
      if (!flight) {
        results.push({ flight: trip.flight_number, skipped: true, reason: "not found" });
        continue;
      }

      const newStatus = mapStatus(flight.status, flight.cancelled);

      if (newStatus !== trip.status) {
        await supabase.from("trips").update({ status: newStatus }).eq("id", trip.id);
        results.push({ flight: trip.flight_number, updated: true, newStatus });
      } else {
        results.push({ flight: trip.flight_number, updated: false });
      }
    } catch (e) {
      results.push({ flight: trip.flight_number, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ checked: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
