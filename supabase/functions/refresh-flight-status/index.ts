// This runs on Supabase's servers, not in the browser — so your FlightAware
// API key stays private. It's scheduled to run automatically (set up in Step 6).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FLIGHTAWARE_API_KEY = Deno.env.get("FLIGHTAWARE_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function computePhase(flight: any): string {
  if (flight.cancelled) return "Cancelled";
  if (flight.actual_in) return "Landed";
  if (flight.actual_off) return "In the air";
  if (flight.actual_out) return "Taxiing";
  return "Scheduled";
}

function computeStatus(flight: any): string {
  if (flight.cancelled) return "cancelled";

  const DELAY_THRESHOLD_MIN = 15;

  function minutesLate(scheduled: string | null, actualOrEstimated: string | null): number {
    if (!scheduled || !actualOrEstimated) return 0;
    return (new Date(actualOrEstimated).getTime() - new Date(scheduled).getTime()) / 60000;
  }

  const depDelay = minutesLate(flight.scheduled_out, flight.actual_out || flight.estimated_out);
  const arrDelay = minutesLate(flight.scheduled_in, flight.actual_in || flight.estimated_in);

  if (depDelay > DELAY_THRESHOLD_MIN || arrDelay > DELAY_THRESHOLD_MIN) return "delayed";
  return "ontime";
}

Deno.serve(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

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
        await supabase.from("trips").update({ verification_issue: `Couldn't verify flight (HTTP ${res.status}) — check the flight number` }).eq("id", trip.id);
        results.push({ flight: trip.flight_number, skipped: true, reason: `HTTP ${res.status}` });
        continue;
      }

      const json = await res.json();
      const flight = json.flights?.[0];
      if (!flight) {
        await supabase.from("trips").update({ verification_issue: "Flight not found — check the flight number and date" }).eq("id", trip.id);
        results.push({ flight: trip.flight_number, skipped: true, reason: "not found" });
        continue;
      }

      const newStatus = mapStatus(flight.status, flight.cancelled);
      const detailFields = {
        phase: computePhase(flight),
        eta: flight.estimated_in || flight.scheduled_in || null,
        gate_destination: flight.gate_destination || null,
        terminal_destination: flight.terminal_destination || null,
        progress_percent: flight.progress_percent ?? null,
        origin_code: flight.origin?.code_iata || flight.origin?.code || null,
        destination_code: flight.destination?.code_iata || flight.destination?.code || null,
        verification_issue: null,
      };

      await supabase.from("trips").update(detailFields).eq("id", trip.id);

      if (newStatus !== trip.status && !trip.manual_override) {
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
