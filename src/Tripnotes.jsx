import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function TripNotes({ tripId, session }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");

  async function loadNotes() {
    setLoading(true);
    const { data, error } = await supabase
      .from("trip_notes")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });
    if (!error) setNotes(data);
    setLoading(false);
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) loadNotes();
  }

  async function addNote(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await supabase.from("trip_notes").insert({
      trip_id: tripId,
      note: text.trim(),
      created_by: session.user.email,
    });
    setText("");
    loadNotes();
  }

  return (
    <div className="notes-wrap">
      <button className="ghost notes-toggle" onClick={toggle} type="button">
        {open ? "Hide notes" : `Notes${notes.length > 0 ? ` (${notes.length})` : ""}`}
      </button>
      {open && (
        <div className="notes-panel">
          {loading ? (
            <div className="notes-empty">Loading…</div>
          ) : notes.length === 0 ? (
            <div className="notes-empty">No notes yet on this trip.</div>
          ) : (
            <div className="notes-list">
              {notes.map((n) => (
                <div className="note" key={n.id}>
                  <div className="note-meta">
                    {n.created_by || "Unknown"} ·{" "}
                    {new Date(n.created_at).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="note-text">{n.note}</div>
                </div>
              ))}
            </div>
          )}
          <form className="note-form" onSubmit={addNote}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a note for the next person working this trip…"
              rows={2}
            />
            <button type="submit">Add note</button>
          </form>
        </div>
      )}
    </div>
  );
}
