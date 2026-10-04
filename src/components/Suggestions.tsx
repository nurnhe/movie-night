import { useEffect, useRef, useState } from "react";
import { kindOf, KIND_LABELS, titleKey } from "../lib/media";
import { pickSources, rankSuggestions, type Suggestion } from "../lib/ratings";
import { posterUrl, recommendations, titleDetails, tmdbConfigured } from "../lib/tmdb";
import type { Group, Movie, NewMovie } from "../lib/types";
import { ShareSelect } from "./ShareSelect";

interface Props {
  movies: Movie[];
  me: string;
  userEmail: string;
  groups: Group[];
  defaultShare: string;
  onAdd: (m: NewMovie, sharedWith: string) => Promise<void>;
  onClose: () => void;
}

type State =
  | { kind: "loading" }
  | { kind: "no-ratings" }
  | { kind: "error"; message: string }
  | { kind: "ready"; items: Suggestion[] };

export function Suggestions({ movies, me, userEmail, groups, defaultShare, onAdd, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<State>(() => (tmdbConfigured ? { kind: "loading" } : { kind: "error", message: "Search isn't set up, so there's nothing to suggest from." }));
  const [added, setAdded] = useState<Set<string>>(new Set()); // titleKeys
  const [busy, setBusy] = useState<string | null>(null);
  const [addError, setAddError] = useState("");
  const [sharedWith, setSharedWith] = useState(defaultShare);
  // Snapshot of the list when the dialog opened, so adding a suggestion doesn't reshuffle the others.
  const snapshot = useRef(movies);

  useEffect(() => { dialog.current?.showModal(); }, []);

  useEffect(() => {
    if (!tmdbConfigured) return;
    const sources = pickSources(snapshot.current, me);
    if (!sources.some((s) => s.stars >= 4)) { setState({ kind: "no-ratings" }); return; }
    let active = true;
    Promise.allSettled(sources.map((s) => recommendations(s.tmdb_id, s.media_type))).then((results) => {
      if (!active) return;
      const fetched = sources.flatMap((s, i) => (results[i].status === "fulfilled" ? [{ ...s, results: results[i].value }] : []));
      if (!fetched.some((s) => s.stars >= 4)) {
        setState({ kind: "error", message: "Couldn't reach TMDB for suggestions. Try again in a moment." });
        return;
      }
      const onList = new Set(snapshot.current.flatMap((m) => (m.tmdb_id != null ? [titleKey(m.media_type, m.tmdb_id)] : [])));
      setState({ kind: "ready", items: rankSuggestions(fetched, onList) });
    });
    return () => { active = false; };
  }, [me]);

  async function add(s: Suggestion) {
    const key = titleKey(s.media_type, s.id);
    setBusy(key);
    setAddError("");
    try {
      const details = await titleDetails(s.id, s.media_type);
      await onAdd({ ...details, note: `Suggested because you liked ${s.because[0]}`, added_by: userEmail, tags: [] }, sharedWith);
      setAdded((cur) => new Set(cur).add(key));
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Couldn't add that title.");
    }
    setBusy(null);
  }

  return (
    <dialog ref={dialog} className="dialog" onClose={onClose}>
      <button type="button" className="dialog-close" aria-label="Close" onClick={() => dialog.current?.close()}>×</button>
      <div className="dialog-body">
        <h2>Suggestions for you</h2>
        {state.kind === "loading" && <p className="muted">Finding titles like the ones you rated highly…</p>}
        {state.kind === "no-ratings" && (
          <p className="muted">Rate a few things you've watched 4 or 5 stars and suggestions will show up here. Low ratings help too: they steer suggestions away from similar titles.</p>
        )}
        {state.kind === "error" && <p className="error">{state.message}</p>}
        {state.kind === "ready" && (state.items.length ? (
          <>
            <p className="muted small">Based on your ratings, using TMDB's recommendations. Titles already on the list are left out.</p>
            <div className="share-row">
              <label htmlFor="suggest-share" className="label">Add them for</label>
              <ShareSelect id="suggest-share" value={sharedWith} onChange={setSharedWith} groups={groups} />
            </div>
            <ul className="results">
              {state.items.map((s) => {
                const key = titleKey(s.media_type, s.id);
                return (
                <li key={key}>
                  {posterUrl(s.poster_path, "w92") ? <img src={posterUrl(s.poster_path, "w92")!} alt="" width={46} height={69} loading="lazy" /> : <div className="poster-ph small" />}
                  <div className="grow">
                    <strong>{s.title}</strong> {s.year && <span className="muted">{s.year}</span>}
                    <div className="muted small">
                      <span className="pill kind">{KIND_LABELS[kindOf(s)]}</span>{" "}
                      {s.rating != null && <>★ {s.rating.toFixed(1)} · </>}
                      Because you liked {s.because.slice(0, 2).join(" and ")}
                    </div>
                  </div>
                  {added.has(key) ? (
                    <span className="pill good">Added</span>
                  ) : (
                    <button className="btn" disabled={busy !== null} onClick={() => add(s)}>{busy === key ? "Adding…" : "Add"}</button>
                  )}
                </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="muted">Nothing new to suggest right now: everything TMDB recommends is already on your list.</p>
        ))}
        {addError && <p className="error">{addError}</p>}
        <div className="dialog-actions">
          <button className="btn" onClick={() => dialog.current?.close()}>Close</button>
        </div>
      </div>
    </dialog>
  );
}
