import { useEffect, useRef, useState } from "react";
import { posterUrl, searchTitles, titleDetails, tmdbConfigured, type SearchResult } from "../lib/tmdb";
import { parseTags } from "../lib/filters";
import { kindOf, KIND_LABELS, titleKey, type Kind } from "../lib/media";
import type { Group, Movie, NewMovie } from "../lib/types";
import { ShareSelect } from "./ShareSelect";

interface Props {
  existing: Movie[];
  userEmail: string;
  groups: Group[];
  defaultShare: string;
  onAdd: (m: NewMovie, sharedWith: string) => Promise<void>;
  onClose: () => void;
}

export function AddMovie({ existing, userEmail, groups, defaultShare, onAdd, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [sharedWith, setSharedWith] = useState(defaultShare);
  const [manualKind, setManualKind] = useState<Kind>("movie");
  const [busy, setBusy] = useState<string | null>(null); // a titleKey, or "manual"
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => { dialog.current?.showModal(); }, []);

  useEffect(() => {
    const q = query.trim();
    if (!tmdbConfigured || q.length < 2) { setResults([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchTitles(q, ctrl.signal)); setError(""); }
      catch { if (!ctrl.signal.aborted) setError("Search isn't responding. Try again, or add the title without details."); }
      finally { if (!ctrl.signal.aborted) setSearching(false); }
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  // A movie and a TV show can share a TMDB id, so both have to match.
  const onList = (r: SearchResult) => existing.find((m) => m.tmdb_id === r.id && m.media_type === r.media_type);

  async function addFromTmdb(r: SearchResult) {
    setBusy(titleKey(r.media_type, r.id));
    try {
      const details = await titleDetails(r.id, r.media_type);
      const genres = details.genres.map((g) => g.toLowerCase());
      await onAdd({ ...details, note: note.trim() || null, added_by: userEmail, tags: parseTags(tagsText).filter((t) => !genres.includes(t)) }, sharedWith);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that title.");
      setBusy(null);
    }
  }

  async function addManual() {
    const title = query.trim();
    if (!title) return;
    setBusy("manual");
    try {
      await onAdd({
        media_type: manualKind === "movie" ? "movie" : "tv", anime: manualKind === "anime",
        tmdb_id: null, imdb_id: null, title, year: null, runtime: null, seasons: null, episodes: null, series_status: null,
        genres: [], rating: null, vote_count: null, poster_path: null, overview: null,
        note: note.trim() || null, added_by: userEmail, tags: parseTags(tagsText),
      }, sharedWith);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that title.");
      setBusy(null);
    }
  }

  return (
    <dialog ref={dialog} className="dialog" onClose={onClose}>
      <button type="button" className="dialog-close" aria-label="Close" onClick={() => dialog.current?.close()}>×</button>
      <div className="dialog-body">
        <h2>Add a title</h2>
        <label htmlFor="search" className="label">Search by title</label>
        <input id="search" type="search" autoFocus placeholder="e.g. Past Lives" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label htmlFor="note" className="label">Note (optional)</label>
        <input id="note" type="text" placeholder="Why you want to watch it" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        <label htmlFor="tags" className="label">Tags (optional) <span className="label-hint">separate with commas</span></label>
        <input id="tags" type="text" placeholder="e.g. cozy, date night" maxLength={300} value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
        <label htmlFor="share" className="label">Share with <span className="label-hint">who sees it on their list</span></label>
        <ShareSelect id="share" value={sharedWith} onChange={setSharedWith} groups={groups} />
        {!tmdbConfigured && <p className="muted small">Search isn't set up yet, so titles are added by name only.</p>}
        {error && <p className="error">{error}</p>}
        <ul className="results" aria-busy={searching}>
          {results.map((r) => {
            const dupe = onList(r);
            const key = titleKey(r.media_type, r.id);
            return (
              <li key={key}>
                {posterUrl(r.poster_path, "w92") ? <img src={posterUrl(r.poster_path, "w92")!} alt="" width={46} height={69} loading="lazy" /> : <div className="poster-ph small" />}
                <div className="grow">
                  <strong>{r.title}</strong> {r.year && <span className="muted">{r.year}</span>}
                  <div className="muted small">
                    <span className="pill kind">{KIND_LABELS[kindOf(r)]}</span>
                    {r.rating != null && <> ★ {r.rating.toFixed(1)}</>}
                  </div>
                </div>
                {dupe ? (
                  <span className="pill">{dupe.watched ? "Watched" : "On the list"}</span>
                ) : (
                  <button className="btn" disabled={busy !== null} onClick={() => addFromTmdb(r)}>{busy === key ? "Adding…" : "Add"}</button>
                )}
              </li>
            );
          })}
        </ul>
        {searching && <p className="muted small">Searching…</p>}
        <div className="dialog-actions">
          {query.trim() && (
            <>
              <select className="manual-kind" aria-label="Type, for a title added without details" value={manualKind} onChange={(e) => setManualKind(e.target.value as Kind)}>
                {(Object.keys(KIND_LABELS) as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
              </select>
              <button className="btn ghost" disabled={busy !== null} onClick={addManual}>
                {busy === "manual" ? "Adding…" : `Add "${query.trim()}" without details`}
              </button>
            </>
          )}
          <button className="btn" onClick={() => dialog.current?.close()}>Close</button>
        </div>
      </div>
    </dialog>
  );
}
