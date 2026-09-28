import { useEffect, useRef, useState } from "react";
import { pickSources, rankSuggestions, type Suggestion } from "../lib/ratings";
import { movieDetails, posterUrl, recommendations, tmdbConfigured } from "../lib/tmdb";
import type { Movie, NewMovie } from "../lib/types";

interface Props {
  movies: Movie[];
  me: string;
  userEmail: string;
  onAdd: (m: NewMovie) => Promise<void>;
  onClose: () => void;
}

type State =
  | { kind: "loading" }
  | { kind: "no-ratings" }
  | { kind: "error"; message: string }
  | { kind: "ready"; items: Suggestion[] };

export function Suggestions({ movies, me, userEmail, onAdd, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<State>(() => (tmdbConfigured ? { kind: "loading" } : { kind: "error", message: "Movie search isn't set up, so there's nothing to suggest from." }));
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [addError, setAddError] = useState("");
  // Snapshot of the list when the dialog opened, so adding a suggestion doesn't reshuffle the others.
  const snapshot = useRef(movies);

  useEffect(() => { dialog.current?.showModal(); }, []);

  useEffect(() => {
    if (!tmdbConfigured) return;
    const sources = pickSources(snapshot.current, me);
    if (!sources.some((s) => s.stars >= 4)) { setState({ kind: "no-ratings" }); return; }
    let active = true;
    Promise.allSettled(sources.map((s) => recommendations(s.tmdb_id))).then((results) => {
      if (!active) return;
      const fetched = sources.flatMap((s, i) => (results[i].status === "fulfilled" ? [{ ...s, results: results[i].value }] : []));
      if (!fetched.some((s) => s.stars >= 4)) {
        setState({ kind: "error", message: "Couldn't reach TMDB for suggestions. Try again in a moment." });
        return;
      }
      const onList = new Set(snapshot.current.map((m) => m.tmdb_id).filter((id): id is number => id != null));
      setState({ kind: "ready", items: rankSuggestions(fetched, onList) });
    });
    return () => { active = false; };
  }, [me]);

  async function add(s: Suggestion) {
    setBusyId(s.id);
    setAddError("");
    try {
      const details = await movieDetails(s.id);
      await onAdd({ ...details, note: `Suggested because you liked ${s.because[0]}`, added_by: userEmail, tags: [] });
      setAdded((cur) => new Set(cur).add(s.id));
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Couldn't add that movie.");
    }
    setBusyId(null);
  }

  return (
    <dialog ref={dialog} className="dialog" onClose={onClose}>
      <div className="dialog-body">
        <h2>Suggestions for you</h2>
        {state.kind === "loading" && <p className="muted">Finding movies like the ones you rated highly…</p>}
        {state.kind === "no-ratings" && (
          <p className="muted">Rate a few movies you've watched 4 or 5 stars and suggestions will show up here. Low ratings help too: they steer suggestions away from similar movies.</p>
        )}
        {state.kind === "error" && <p className="error">{state.message}</p>}
        {state.kind === "ready" && (state.items.length ? (
          <>
            <p className="muted small">Based on your ratings, using TMDB's recommendations. Movies already on the list are left out.</p>
            <ul className="results">
              {state.items.map((s) => (
                <li key={s.id}>
                  {posterUrl(s.poster_path, "w92") ? <img src={posterUrl(s.poster_path, "w92")!} alt="" width={46} height={69} loading="lazy" /> : <div className="poster-ph small" />}
                  <div className="grow">
                    <strong>{s.title}</strong> {s.year && <span className="muted">{s.year}</span>}
                    <div className="muted small">
                      {s.rating != null && <>★ {s.rating.toFixed(1)} · </>}
                      Because you liked {s.because.slice(0, 2).join(" and ")}
                    </div>
                  </div>
                  {added.has(s.id) ? (
                    <span className="pill good">Added</span>
                  ) : (
                    <button className="btn" disabled={busyId !== null} onClick={() => add(s)}>{busyId === s.id ? "Adding…" : "Add"}</button>
                  )}
                </li>
              ))}
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
