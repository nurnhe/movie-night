import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createGroup, deleteGroup, loadMemberDirectory, updateGroup } from "../lib/groups";
import { firestoreMessage } from "../lib/firestoreErrors";
import { MAX_GROUP_NAME, MAX_MEMBERS, mergePeople, normalizeEmail, personLabel } from "../lib/groupLogic";
import type { Group, Person } from "../lib/types";

interface Props {
  group: Group | null; // null creates a new group
  me: string;
  knownEmails: (string | null)[]; // people seen on movies or in my groups, for when the member list can't be read
  onCreated: (groupId: string) => void;
  onClose: () => void;
}

const errorText = firestoreMessage;

const directoryErrorText = (e: unknown) =>
  typeof e === "object" && e && "code" in e && e.code === "permission-denied"
    ? "Firebase's rules don't allow it yet: publish the latest firestore.rules."
    : errorText(e);

export function GroupDialog({ group, me, knownEmails, onCreated, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(group?.name ?? "");
  const [others, setOthers] = useState<string[]>(group ? group.members.filter((e) => e !== me) : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [directory, setDirectory] = useState<Person[] | null>(null);
  const [directoryError, setDirectoryError] = useState("");
  const [typed, setTyped] = useState("");

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let active = true;
    loadMemberDirectory().then(
      (people) => { if (active) setDirectory(people); },
      (e) => { if (active) setDirectoryError(directoryErrorText(e)); },
    );
    return () => { active = false; };
  }, []);

  const people = useMemo(() => mergePeople(directory ?? [], knownEmails), [directory, knownEmails]);
  const loadingPeople = directory === null && !directoryError;

  const close = () => dialog.current?.close();

  const candidates = people.filter((p) => p.email !== me && !others.includes(p.email));
  const labelFor = (email: string) => {
    const person = people.find((p) => p.email === email);
    return person ? personLabel(person) : email;
  };

  function addPerson(email: string) {
    if (!email || email === me || others.includes(email)) return;
    if (others.length + 2 > MAX_MEMBERS) { setError(`A group can have up to ${MAX_MEMBERS} people.`); return; }
    setOthers([...others, email]);
    setError("");
  }

  function withTyped(): string[] | null {
    if (!typed.trim()) return others;
    const email = normalizeEmail(typed);
    if (!email) { setError(`"${typed.trim()}" isn't an email address.`); return null; }
    if (email === me || others.includes(email)) { setTyped(""); return others; }
    if (others.length + 2 > MAX_MEMBERS) { setError(`A group can have up to ${MAX_MEMBERS} people.`); return null; }
    const next = [...others, email];
    setOthers(next);
    setTyped("");
    setError("");
    return next;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const members = withTyped();
    if (!members) return;
    const trimmed = name.trim();
    if (!trimmed) { setError("Give the group a name."); return; }
    setBusy(true);
    setError("");
    try {
      if (group) {
        const before = group.members.filter((p) => p !== me);
        await updateGroup(group.id, {
          name: trimmed,
          added: members.filter((p) => !before.includes(p)),
          removed: before.filter((p) => !members.includes(p)),
        });
      } else {
        onCreated(await createGroup(trimmed, members, me));
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
        <select aria-label="Add a person" value="" onChange={(e) => addPerson(e.target.value)} disabled={loadingPeople || !candidates.length}>
          <option value="">{loadingPeople ? "Loading people…" : candidates.length ? "Add a person…" : "Everyone is already in this group"}</option>
          {candidates.map((p) => <option key={p.email} value={p.email}>{personLabel(p)}</option>)}
        </select>
        {directoryError ? (
          <>
            <p className="notice small">
              Couldn't load everyone who can use the app, so this only lists people you share movies or groups with. {directoryError} You can still type an email:
            </p>
            <div className="add-person">
              <input type="text" inputMode="email" autoComplete="off" aria-label="Add a person by email" placeholder="their.email@example.com" value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); withTyped(); } }} />
              <button type="button" className="btn" onClick={withTyped} disabled={!typed.trim()}>Add</button>
            </div>
          </>
        ) : (
          <p className="muted small">Lists everyone who can use the app. To add someone new, give them access in Firebase first.</p>
        )}

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
