import { useEffect, useRef, useState, type FormEvent } from "react";
import { copyMoviesInto, createGroup, deleteGroup, updateGroup, type StoredMovie } from "../lib/groups";
import { MAX_GROUP_NAME, MAX_MEMBERS, parseEmails } from "../lib/groupLogic";
import type { Group } from "../lib/types";

interface Props {
  group: Group | null; // null creates a new group
  me: string;
  originalList: StoredMovie[];
  firstGroup: boolean;
  onCreated: (groupId: string) => void;
  onClose: () => void;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Try again.");

export function GroupDialog({ group, me, originalList, firstGroup, onCreated, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(group?.name ?? "");
  const [others, setOthers] = useState<string[]>(group ? group.members.filter((e) => e !== me) : []);
  const [draft, setDraft] = useState("");
  const [bringOver, setBringOver] = useState(firstGroup && originalList.length > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
        const id = await createGroup(trimmed, people, me);
        onCreated(id);
        if (bringOver) await copyMoviesInto(id, originalList);
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

  async function copyOriginal() {
    if (!group) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const n = await copyMoviesInto(group.id, originalList);
      setNotice(n ? `Copied ${n} movie${n === 1 ? "" : "s"} into this group.` : "Everything from the original list is already here.");
    } catch (err) { setError(errorText(err)); }
    setBusy(false);
  }

  const solo = group !== null && group.members.length <= 1;

  return (
    <dialog ref={dialog} className="dialog" onClose={onClose}>
      <form className="dialog-body" onSubmit={save}>
        <h2>{group ? "Group settings" : "New group"}</h2>

        <label htmlFor="group-name" className="label">Name</label>
        <input id="group-name" type="text" autoFocus={!group} maxLength={MAX_GROUP_NAME} placeholder="e.g. Friday movie night"
          value={name} onChange={(e) => setName(e.target.value)} />

        <span className="label">People <span className="label-hint">everyone here sees and edits this list</span></span>
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
        <p className="muted small">People sign in with the email you add here. Anyone without an account yet needs one created in Firebase first.</p>

        {!group && originalList.length > 0 && (
          <label className="check">
            <input type="checkbox" checked={bringOver} onChange={(e) => setBringOver(e.target.checked)} />
            Bring over the {originalList.length} movie{originalList.length === 1 ? "" : "s"} from the original shared list
          </label>
        )}
        {group && originalList.length > 0 && (
          <p className="small">
            <button type="button" className="linklike" onClick={copyOriginal} disabled={busy}>
              Copy movies from the original shared list into this group
            </button>
          </p>
        )}

        {notice && <p className="notice small">{notice}</p>}
        {error && <p className="error">{error}</p>}

        <div className="dialog-actions">
          {group && (solo ? (
            <button type="button" className="btn ghost danger" disabled={busy}
              onClick={() => act(`Delete "${group.name}" and everything on its list? This can't be undone.`, () => deleteGroup(group.id))}>
              Delete group
            </button>
          ) : (
            <button type="button" className="btn ghost danger" disabled={busy}
              onClick={() => act(`Leave "${group.name}"? You'll lose access to its list unless someone adds you back.`, () => updateGroup(group.id, { removed: [me] }))}>
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
