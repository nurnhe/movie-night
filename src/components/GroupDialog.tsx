import { useEffect, useRef, useState, type FormEvent } from "react";
import { createGroup, deleteGroup, updateGroup } from "../lib/groups";
import { MAX_GROUP_NAME, MAX_MEMBERS, personLabel } from "../lib/groupLogic";
import type { Group, Person } from "../lib/types";

interface Props {
  group: Group | null; // null creates a new group
  me: string;
  people: Person[];
  onCreated: (groupId: string) => void;
  onClose: () => void;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Try again.");

export function GroupDialog({ group, me, people, onCreated, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(group?.name ?? "");
  const [others, setOthers] = useState<string[]>(group ? group.members.filter((e) => e !== me) : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { dialog.current?.showModal(); }, []);

  const close = () => dialog.current?.close();

  const candidates = people.filter((p) => p.email !== me && !others.includes(p.email));
  const labelFor = (email: string) => {
    const person = people.find((p) => p.email === email);
    return person ? personLabel(person) : email;
  };

  function addPerson(email: string) {
    if (!email) return;
    if (others.length + 2 > MAX_MEMBERS) { setError(`A group can have up to ${MAX_MEMBERS} people.`); return; }
    setOthers([...others, email]);
    setError("");
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError("Give the group a name."); return; }
    setBusy(true);
    setError("");
    try {
      if (group) {
        const before = group.members.filter((p) => p !== me);
        await updateGroup(group.id, {
          name: trimmed,
          added: others.filter((p) => !before.includes(p)),
          removed: before.filter((p) => !others.includes(p)),
        });
      } else {
        onCreated(await createGroup(trimmed, others, me));
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
          <li><span>{labelFor(me)}</span><span className="pill">You</span></li>
          {others.map((p) => (
            <li key={p}>
              <span>{labelFor(p)}</span>
              <button type="button" className="btn ghost small" onClick={() => setOthers(others.filter((o) => o !== p))} aria-label={`Remove ${p}`}>Remove</button>
            </li>
          ))}
        </ul>
        <select aria-label="Add a person" value="" onChange={(e) => addPerson(e.target.value)} disabled={!candidates.length}>
          <option value="">{candidates.length ? "Add a person…" : "Everyone is already in this group"}</option>
          {candidates.map((p) => <option key={p.email} value={p.email}>{personLabel(p)}</option>)}
        </select>
        <p className="muted small">Lists everyone who can use the app. To add someone new, give them access in Firebase first.</p>

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
