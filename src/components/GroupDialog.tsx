import { useEffect, useRef, useState, type FormEvent } from "react";
import { createGroup, deleteGroup, updateGroup } from "../lib/groups";
import { MAX_GROUP_NAME, MAX_MEMBERS, parseEmails } from "../lib/groupLogic";
import type { Group } from "../lib/types";

interface Props {
  group: Group | null; // null creates a new group
  me: string;
  onCreated: (groupId: string) => void;
  onClose: () => void;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Try again.");

export function GroupDialog({ group, me, onCreated, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(group?.name ?? "");
  const [others, setOthers] = useState<string[]>(group ? group.members.filter((e) => e !== me) : []);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { dialog.current?.showModal(); }, []);

  const close = () => dialog.current?.close();

  function addDraft(): string[] | null {
    const { valid, invalid } = parseEmails(draft);
    if (invalid.length) { setError(`"${invalid[0]}" isn't an email address.`); return null; }
    const next = [...new Set([...others, ...valid.filter((e) => e !== me)])];
    if (next.length + 1 > MAX_MEMBERS) { setError(`A group can have up to ${MAX_MEMBERS} people.`); return null; }
    setOthers(next);
    setDraft("");
    setError("");
    return next;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const people = draft.trim() ? addDraft() : others;
    if (!people) return;
    const trimmed = name.trim();
    if (!trimmed) { setError("Give the group a name."); return; }
    setBusy(true);
    setError("");
    try {
      if (group) {
        const before = group.members.filter((p) => p !== me);
        await updateGroup(group.id, {
          name: trimmed,
          added: people.filter((p) => !before.includes(p)),
          removed: before.filter((p) => !people.includes(p)),
        });
      } else {
        onCreated(await createGroup(trimmed, people, me));
      }
      close();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  async function act(confirmText: string, action: () => Promise<unknown>) {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setError("");
    try { await action(); close(); }
    catch (err) { setError(errorText(err)); setBusy(false); }
  }

  const solo = group !== null && group.members.length <= 1;

  return (
    <dialog ref={dialog} className="dialog" onClose={onClose}>
      <form className="dialog-body" onSubmit={save}>
        <h2>{group ? "Group settings" : "New group"}</h2>

        <label htmlFor="group-name" className="label">Name</label>
        <input id="group-name" type="text" autoFocus={!group} maxLength={MAX_GROUP_NAME} placeholder="e.g. Me and Sam"
          value={name} onChange={(e) => setName(e.target.value)} />

        <span className="label">People <span className="label-hint">the group filter shows movies any of them added</span></span>
        <ul className="people">
          <li><span>{me}</span><span className="pill">You</span></li>
          {others.map((p) => (
            <li key={p}>
              <span>{p}</span>
              <button type="button" className="btn ghost small" onClick={() => setOthers(others.filter((o) => o !== p))} aria-label={`Remove ${p}`}>Remove</button>
            </li>
          ))}
        </ul>
        <div className="add-person">
          <input type="text" inputMode="email" autoComplete="off" aria-label="Add people by email" placeholder="Add by email, e.g. partner@example.com"
            value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (draft.trim()) addDraft(); } }} />
          <button type="button" className="btn" onClick={addDraft} disabled={!draft.trim()}>Add</button>
        </div>
        <p className="muted small">Use the email they sign in with. Adding someone here doesn't give them access to the app; that's set up in Firebase.</p>

        {error && <p className="error">{error}</p>}

        <div className="dialog-actions">
          {group && (solo ? (
            <button type="button" className="btn ghost danger" disabled={busy}
              onClick={() => act(`Delete the group "${group.name}"? Movies stay on the list.`, () => deleteGroup(group.id))}>
              Delete group
            </button>
          ) : (
            <button type="button" className="btn ghost danger" disabled={busy}
              onClick={() => act(`Leave "${group.name}"? It will disappear from your filters. Movies stay on the list.`, () => updateGroup(group.id, { removed: [me] }))}>
              Leave group
            </button>
          ))}
          <span className="spacer" />
          <button type="button" className="btn" onClick={close}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? "Saving…" : group ? "Save" : "Create group"}</button>
        </div>
      </form>
    </dialog>
  );
}
