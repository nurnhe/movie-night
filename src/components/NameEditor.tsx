import { useEffect, useState, type FormEvent } from "react";
import { displayName, MAX_NAME_LENGTH } from "../lib/groupLogic";
import type { Person } from "../lib/types";

interface Props {
  me: string;
  people: Person[];
  onSave: (name: string) => Promise<unknown>;
}

export function NameEditor({ me, people, onSave }: Props) {
  const current = people.find((p) => p.email === me)?.name.trim() ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (!editing) setDraft(current); }, [current, editing]);

  async function save(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) { setError("Enter a name."); return; }
    if (trimmed === current) { setEditing(false); return; }
    setBusy(true);
    try { await onSave(trimmed); setEditing(false); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn't save your name."); }
    setBusy(false);
  }

  if (!editing) {
    return (
      <button type="button" className="linklike small" onClick={() => setEditing(true)}>
        {current ? displayName(me, people) : "Add your name"}
      </button>
    );
  }

  return (
    <form className="name-editor" onSubmit={save}>
      <input type="text" aria-label="Your name" autoFocus maxLength={MAX_NAME_LENGTH} value={draft}
        onChange={(e) => setDraft(e.target.value)} onBlur={() => { if (!busy) { setEditing(false); setError(""); } }} />
      <button type="submit" className="btn small" disabled={busy} onMouseDown={(e) => e.preventDefault()}>Save</button>
      {error && <span className="error small">{error}</span>}
    </form>
  );
}
