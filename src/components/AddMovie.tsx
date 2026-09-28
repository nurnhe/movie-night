import { useEffect, useRef, useState } from "react";
import { movieDetails, posterUrl, searchMovies, tmdbConfigured, type SearchResult } from "../lib/tmdb";
import type { Movie, NewMovie } from "../lib/types";

interface Props {
  existing: Movie[];
  userEmail: string;
  onAdd: (m: NewMovie) => Promise<void>;
  onClose: () => void;
}

export function AddMovie({ existing, userEmail, onAdd, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<number | "manual" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => { dialog.current?.showModal(); }, []);

  useEffect(() => {
    const q = query.trim();
    if (!tmdbConfigured || q.length < 2) { setResults([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchMovies(q, ctrl.signal)); setError(""); }
      catch { if (!ctrl.signal.aborted) setError("Movie search isn't responding. Try again, or add the title without details."); }
      finally { if (!ctrl.signal.aborted) setSearching(false); }
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  const onList = (id: number) => existing.find((m) => m.tmdb_id === id);

  async function addFromTmdb(r: SearchResult) {
    setBusyId(r.id);
    try {
      const details = await movieDetails(r.id);
      await onAdd({ ...details, note: note.trim() || null, added_by: userEmail });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that movie.");
      setBusyId(null);
    }
  }

  async function addManual() {
    const title = query.trim();
    if (!title) return;
    setBusyId("manual");
    try {
      await onAdd({ tmdb_id: null, imdb_id: null, title, year: null, runtime: null, genres: [], rating: null, vote_count: null, poster_path: null, overview: null, note: note.trim() || null, added_by: userEmail });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that movie.");
      setBusyId(null);
    }
  }

  return (
    <dialog ref={dialog} className="dialog" onClose={onClose}>
      <div className="dialog-body">
        <h2>Add a movie</h2>
        <label htmlFor="search" className="label">Search by title</label>
        <input id="search" type="search" autoFocus placeholder="e.g. Past Lives" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label htmlFor="note" className="label">Note (optional)</label>
        <input id="note" type="text" placeholder="Why you want to watch it" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        {!tmdbConfigured && <p className="muted small">Movie search isn't set up yet, so movies are added by title only.</p>}
        {error && <p className="error">{error}</p>}
        <ul className="results" aria-busy={searching}>
          {results.map((r) => {
            const dupe = onList(r.id);
            return (
              <li key={r.id}>
                {posterUrl(r.poster_path, "w92") ? <img src={posterUrl(r.poster_path, "w92")!} alt="" width={46} height={69} loading="lazy" /> : <div className="poster-ph small" />}
                <div className="grow">
                  <strong>{r.title}</strong> {r.year && <span className="muted">{r.year}</span>}
                  {r.rating != null && <div className="muted small">★ {r.rating.toFixed(1)}</div>}
                </div>
                {dupe ? (
                  <span className="pill">{dupe.watched ? "Watched" : "On the list"}</span>
                ) : (
                  <button className="btn" disabled={busyId !== null} onClick={() => addFromTmdb(r)}>{busyId === r.id ? "Adding…" : "Add"}</button>
                )}
              </li>
            );
          })}
        </ul>
        {searching && <p className="muted small">Searching…</p>}
        <div className="dialog-actions">
          {query.trim() && (
            <button className="btn ghost" disabled={busyId !== null} onClick={addManual}>
              {busyId === "manual" ? "Adding…" : `Add "${query.trim()}" without details`}
            </button>
          )}
          <button className="btn" onClick={() => dialog.current?.close()}>Close</button>
        </div>
      </div>
    </dialog>
  );
}
